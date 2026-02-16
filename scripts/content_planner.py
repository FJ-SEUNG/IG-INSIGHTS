#!/usr/bin/env python3
"""
AI Content Planner - 일본 뉴스 기반 콘텐츠 기획 자동 생성
Uses RSS feeds + Google Gemma AI to generate Instagram content ideas
"""

import os
import json
import re
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import feedparser
import requests

# ═══════════════════════════════════════════════════════════════
# 설정
# ═══════════════════════════════════════════════════════════════

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent'

# 일본 뉴스 RSS 피드
RSS_FEEDS = [
    {
        'name': 'Yahoo Japan 여행',
        'url': 'https://news.yahoo.co.jp/rss/topics/travel.xml',
        'category': 'tips'
    },
    {
        'name': 'Yahoo Japan 국내',
        'url': 'https://news.yahoo.co.jp/rss/topics/domestic.xml',
        'category': 'breaking'
    },
    {
        'name': 'NHK World Japan',
        'url': 'https://www3.nhk.or.jp/rss/news/cat0.xml',
        'category': 'breaking'
    },
]

# 여행 관련 키워드 (일본어 + 영어)
TRAVEL_KEYWORDS = [
    # 교통
    'JR', '新幹線', '신칸센', 'shinkansen', '電車', 'train', '空港', 'airport',
    '成田', '羽田', '関空', '飛行機', 'flight', '運休', '遅延', 'delay',
    # 관광지
    '東京', '大阪', '京都', '福岡', '北海道', '沖縄', '観光', 'tourism',
    '温泉', 'onsen', '富士山', 'mount fuji', 'ディズニー', 'disney', 'USJ',
    # 음식
    'ラーメン', 'ramen', '寿司', 'sushi', '居酒屋', 'izakaya', '一蘭',
    # 쇼핑
    '免税', 'tax free', 'duty free', '百貨店', 'department',
    # 계절/이벤트
    '桜', 'cherry blossom', '紅葉', 'autumn leaves', '花火', 'fireworks',
    '祭り', 'festival', 'matsuri',
    # 긴급/안전
    '地震', 'earthquake', '台風', 'typhoon', '火災', 'fire', '注意', 'warning',
    '閉鎖', 'closed', '規制', 'regulation',
    # 일반
    '旅行', 'travel', '観光客', 'tourist', '外国人', 'foreigner', 'インバウンド',
]

OUTPUT_PATH = 'docs/data/content_plans.json'
DAILY_GENERATE = 2   # 하루 생성 개수
MAX_PLANS = 14       # 최대 보관 (7일 x 2개 = 14개)

# ═══════════════════════════════════════════════════════════════
# RSS 뉴스 수집
# ═══════════════════════════════════════════════════════════════

def fetch_rss_news() -> List[Dict]:
    """RSS 피드에서 뉴스 수집"""
    all_news = []

    for feed_info in RSS_FEEDS:
        try:
            print(f"📰 Fetching: {feed_info['name']}")
            feed = feedparser.parse(feed_info['url'])

            for entry in feed.entries[:10]:  # 피드당 최대 10개
                news_item = {
                    'title': entry.get('title', ''),
                    'link': entry.get('link', ''),
                    'summary': entry.get('summary', entry.get('description', '')),
                    'published': entry.get('published', ''),
                    'source': feed_info['name'],
                    'default_category': feed_info['category']
                }
                all_news.append(news_item)

        except Exception as e:
            print(f"❌ Error fetching {feed_info['name']}: {e}")

    return all_news

def filter_travel_related(news_list: List[Dict]) -> List[Dict]:
    """여행 관련 뉴스만 필터링"""
    filtered = []

    for news in news_list:
        text = f"{news['title']} {news['summary']}".lower()

        for keyword in TRAVEL_KEYWORDS:
            if keyword.lower() in text:
                news['matched_keyword'] = keyword
                filtered.append(news)
                break

    print(f"✅ Filtered {len(filtered)} travel-related news from {len(news_list)} total")
    return filtered

def categorize_news(news: Dict) -> str:
    """뉴스 카테고리 자동 분류"""
    text = f"{news['title']} {news['summary']}".lower()

    # 긴급/속보
    if any(kw in text for kw in ['地震', '台風', '火災', 'earthquake', 'typhoon', 'fire', '閉鎖', '事故']):
        return 'breaking'

    # 교통
    if any(kw in text for kw in ['JR', '新幹線', '電車', '空港', '運休', '遅延', 'train', 'flight']):
        return 'transport'

    # 시즌/날씨
    if any(kw in text for kw in ['桜', '紅葉', '花火', '雪', 'cherry', 'autumn', 'fireworks']):
        return 'season'

    # 이벤트/축제
    if any(kw in text for kw in ['祭り', 'festival', 'イベント', 'event', '開催']):
        return 'event'

    # 핫플/신규
    if any(kw in text for kw in ['オープン', 'open', '新', 'new', 'リニューアル']):
        return 'hotplace'

    return news.get('default_category', 'tips')

# ═══════════════════════════════════════════════════════════════
# Gemma AI 콘텐츠 생성
# ═══════════════════════════════════════════════════════════════

def generate_content_with_gemma(news: Dict) -> Optional[Dict]:
    """Gemma AI로 콘텐츠 기획 생성"""
    if not GEMINI_API_KEY:
        print("⚠️ GEMINI_API_KEY not set, skipping AI generation")
        return None

    prompt = f"""당신은 일본 여행 인스타그램 계정 'Flying Japan'의 콘텐츠 기획자입니다.
다음 일본 뉴스를 바탕으로 한국인 여행자를 위한 인스타그램 콘텐츠를 기획해주세요.

[뉴스 정보]
제목: {news['title']}
내용: {news['summary']}
출처: {news['source']}

[요구사항]
1. 한국인 일본 여행자 관점에서 유용한 정보로 재구성
2. 인스타그램에 적합한 짧고 임팩트 있는 문체
3. 이모지를 적절히 활용
4. 실제 여행 시 도움되는 실용적 정보 포함

[응답 형식 - 반드시 JSON으로]
{{
  "title": "인스타그램 게시물 제목 (이모지 포함, 30자 이내)",
  "hook": "관심을 끄는 한 줄 문구 (20자 이내)",
  "body": "본문 내용 (줄바꿈 포함, 200-300자)",
  "hashtags": ["#해시태그1", "#해시태그2", ... 8개],
  "image_keyword": "이미지 검색용 영어 키워드 (예: tokyo station, osaka castle)"
}}

JSON만 출력하세요. 다른 설명 없이 JSON 객체만 반환하세요."""

    try:
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            headers={'Content-Type': 'application/json'},
            json={
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {
                    'temperature': 0.7,
                    'maxOutputTokens': 1024,
                }
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            text = result['candidates'][0]['content']['parts'][0]['text']

            # JSON 추출
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                content = json.loads(json_match.group())
                return content
        else:
            print(f"❌ Gemma API error: {response.status_code} - {response.text[:200]}")

    except Exception as e:
        print(f"❌ Error generating content: {e}")

    return None

def create_plan_from_news(news: Dict, content: Optional[Dict]) -> Dict:
    """뉴스와 AI 콘텐츠로 기획 객체 생성"""
    category = categorize_news(news)
    plan_id = f"plan_{hashlib.md5(news['title'].encode()).hexdigest()[:8]}"

    # AI 콘텐츠가 없으면 기본 템플릿 사용
    if not content:
        content = {
            'title': f"📰 {news['title'][:30]}...",
            'hook': '자세한 내용은 본문에서!',
            'body': f"[뉴스 요약]\n{news['summary'][:200]}...\n\n✈️ 일본 여행 시 참고하세요!",
            'hashtags': ['#일본여행', '#일본뉴스', '#플라잉재팬', '#여행정보', '#일본'],
            'image_keyword': 'japan travel'
        }

    image_keyword = content.get('image_keyword', 'japan travel')

    return {
        'id': plan_id,
        'created_at': datetime.now().isoformat(),
        'category': category,
        'priority': 'high' if category == 'breaking' else 'medium',
        'status': 'new',
        'source': {
            'title': news['title'],
            'url': news['link'],
            'date': news.get('published', datetime.now().strftime('%Y-%m-%d'))
        },
        'content': {
            'title': content.get('title', ''),
            'hook': content.get('hook', ''),
            'body': content.get('body', ''),
            'hashtags': content.get('hashtags', [])
        },
        'image': {
            'keyword': image_keyword,
            'unsplash_url': f"https://unsplash.com/s/photos/{image_keyword.replace(' ', '-')}",
            'pexels_url': f"https://www.pexels.com/search/{image_keyword.replace(' ', '%20')}/"
        }
    }

# ═══════════════════════════════════════════════════════════════
# 메인 실행
# ═══════════════════════════════════════════════════════════════

def load_existing_plans() -> Dict:
    """기존 기획 데이터 로드"""
    try:
        with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {'last_updated': None, 'plans': []}

def save_plans(data: Dict):
    """기획 데이터 저장"""
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"💾 Saved {len(data['plans'])} plans to {OUTPUT_PATH}")

def main():
    print("🚀 Starting Content Planner...")
    print(f"📅 {datetime.now().isoformat()}")

    # 1. 기존 데이터 로드
    existing_data = load_existing_plans()
    existing_ids = {p['id'] for p in existing_data.get('plans', [])}

    # 2. RSS 뉴스 수집
    all_news = fetch_rss_news()
    travel_news = filter_travel_related(all_news)

    # 3. 새 기획 생성 (하루 DAILY_GENERATE개)
    new_plans = []
    generated_count = 0

    for news in travel_news:
        if generated_count >= DAILY_GENERATE:
            break

        plan_id = f"plan_{hashlib.md5(news['title'].encode()).hexdigest()[:8]}"

        if plan_id in existing_ids:
            print(f"⏭️ Skipping duplicate: {news['title'][:30]}...")
            continue

        print(f"🤖 Generating content for: {news['title'][:40]}...")
        content = generate_content_with_gemma(news)
        plan = create_plan_from_news(news, content)
        new_plans.append(plan)
        generated_count += 1

        # API 레이트 리밋 방지
        import time
        time.sleep(2)

    # 4. 기존 + 새 기획 병합 (최신순, 최대 MAX_PLANS개)
    all_plans = new_plans + existing_data.get('plans', [])
    all_plans.sort(key=lambda x: x['created_at'], reverse=True)
    all_plans = all_plans[:MAX_PLANS]

    # 5. 저장
    output_data = {
        'last_updated': datetime.now().isoformat(),
        'plans': all_plans
    }
    save_plans(output_data)

    print(f"✅ Done! Generated {len(new_plans)} new plans, total {len(all_plans)} plans")

if __name__ == '__main__':
    main()
