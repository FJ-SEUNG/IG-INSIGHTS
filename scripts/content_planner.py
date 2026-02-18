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

# 일본 뉴스 RSS 피드 (여행/관광 특화)
RSS_FEEDS = [
    # 여행/관광 전문
    {
        'name': 'Yahoo Japan 여행',
        'url': 'https://news.yahoo.co.jp/rss/topics/travel.xml',
        'category': 'tips'
    },
    {
        'name': 'トラベルWatch',
        'url': 'https://travel.watch.impress.co.jp/data/rss/1.0/trw/feed.rdf',
        'category': 'tips'
    },
    {
        'name': 'Traicy 여행',
        'url': 'https://www.traicy.com/feed',
        'category': 'transport'
    },
    # 항공/교통
    {
        'name': 'FlyTeam 항공',
        'url': 'https://flyteam.jp/news/rss',
        'category': 'transport'
    },
    # 음식/편의점/쇼핑
    {
        'name': 'グルメWatch',
        'url': 'https://gourmet.watch.impress.co.jp/data/rss/1.0/grw/feed.rdf',
        'category': 'hotplace'
    },
    {
        'name': 'ITmedia 라이프',
        'url': 'https://rss.itmedia.co.jp/rss/2.0/lifestyle.xml',
        'category': 'tips'
    },
    # 일반 뉴스 (속보용)
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
    # 교통 (항공사/공항 포함)
    'JR', '新幹線', '신칸센', 'shinkansen', '電車', 'train', '空港', 'airport',
    '成田', '羽田', '関空', '飛行機', 'flight', '運休', '遅延', 'delay',
    'ANA', 'JAL', '航空', 'airline', '仁川', '金浦', '대한항공', '아시아나',
    'ピーチ', 'peach', 'ジェットスター', 'jetstar', 'LCC',
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
    # 긴급/안전/사건사고
    '地震', 'earthquake', '台風', 'typhoon', '火災', 'fire', '注意', 'warning',
    '閉鎖', 'closed', '規制', 'regulation', '事件', '事故', '殺人', '犯罪',
    '安全', 'safety', '警察', 'police', '注意喚起',
    # 환율/경제
    '円', '円安', '円高', '為替', 'exchange', 'rate', '両替', 'yen',
    # 일반
    '旅行', 'travel', '観光客', 'tourist', '外国人', 'foreigner', 'インバウンド',
    # 한국인 관광지역
    '心斎橋', '道頓堀', '新宿', '渋谷', '原宿', '浅草', '銀座',
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
    """여행 관련 뉴스만 필터링 (느슨한 필터링)"""
    filtered = []

    # 더 넓은 범위의 키워드 (일본 관련 전반)
    broad_keywords = TRAVEL_KEYWORDS + [
        # 지역명
        '東京', '大阪', '京都', '福岡', '北海道', '沖縄', '名古屋', '横浜',
        'tokyo', 'osaka', 'kyoto', 'fukuoka', 'hokkaido', 'okinawa',
        # 일본 문화/생활
        '日本', 'japan', 'japanese', 'マクドナルド', 'コンビニ', 'カフェ',
        'ユニクロ', 'ドンキ', 'daiso', '100均', 'セブン', 'ローソン', 'ファミマ',
        # 음식 일반
        '食', '店', 'グルメ', '人気', '新商品', '限定', 'オープン', '開店',
        # 가격/할인
        '円', '無料', '半額', 'セール', '割引', '値上げ',
        # 이벤트
        'イベント', 'キャンペーン', '期間限定',
    ]

    for news in news_list:
        text = f"{news['title']} {news['summary']}".lower()

        for keyword in broad_keywords:
            if keyword.lower() in text:
                news['matched_keyword'] = keyword
                filtered.append(news)
                break

    print(f"✅ Filtered {len(filtered)} travel-related news from {len(news_list)} total")

    # 필터링된 게 너무 적으면 원본 뉴스 중 일부라도 사용
    if len(filtered) < DAILY_GENERATE and len(news_list) > 0:
        print(f"⚠️ Not enough filtered news, using top {DAILY_GENERATE} from all news")
        return news_list[:DAILY_GENERATE * 2]

    return filtered

def categorize_news(news: Dict) -> str:
    """뉴스 카테고리 자동 분류"""
    text = f"{news['title']} {news['summary']}".lower()

    # 긴급/속보 (사건사고, 재해, 환율급변 포함)
    if any(kw in text for kw in ['地震', '台風', '火災', 'earthquake', 'typhoon', 'fire', '閉鎖', '事故',
                                  '事件', '殺人', '犯罪', '警察', '円安', '円高', '為替', '急落', '急騰']):
        return 'breaking'

    # 교통 (항공사/공항 포함)
    if any(kw in text for kw in ['JR', '新幹線', '電車', '空港', '運休', '遅延', 'train', 'flight',
                                  '航空', 'ANA', 'JAL', 'airline', 'LCC', 'ピーチ', 'ジェットスター',
                                  '成田', '羽田', '関空', '仁川', '金浦']):
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

    prompt = f"""당신은 "한국인 일본 여행자 대상 인스타그램 콘텐츠 기획자"입니다.
목표: 한국에서 일본으로 여행 오는 한국인 여행자에게 실질적으로 도움이 되는 정보만 콘텐츠로 제작합니다.

⚠️ 중요 규칙:
1. 반드시 "일본 여행"과 직접 관련된 이슈만 콘텐츠로 만드세요
2. 모든 콘텐츠는 반드시 "한국어"로 작성하세요 (일본어 사용 금지)
3. 일본이 아닌 다른 나라(이탈리아, 미국 등) 관련 내용은 절대 제작하지 마세요
4. 외부 사이트/출처 언급 금지! (트래블워치, 야후재팬 등 원본 출처를 언급하지 마세요)

[뉴스 정보]
제목: {news['title']}
내용: {news['summary']}
출처: {news['source']}

[판단 기준]

✅ 적합한 이슈 (콘텐츠로 만들어야 함):
- 일본 맛집/카페/편의점 신상품/한정메뉴 출시
- 일본 교통 정보 (JR패스, 지하철, 운휴, 지연)
- 일본/한국 공항 정보 (성田, 하네다, 간사이, 인천, 김포 등)
- 항공사 정보 (JAL, ANA, 피치, 대한항공, 아시아나 등)
- 일본 관광지 규제/입장료/예약 변경
- 일본 축제/이벤트/시즌 정보 (벚꽃, 단풍, 불꽃축제)
- 일본 쇼핑 (면세, 할인, 신규 오픈)
- 일본 숙소/환전/입국 관련 정보
- 일본 날씨/재해/안전 정보
- 엔화 환율 변동 (원/엔 환율 급등락)
- 일본 현지 사건사고 (관광객이 알아야 할 치안/안전 이슈, 예: 도톤보리 사건 등)
- 관광정책 변경 (비자, 입국심사, 면세한도 등)

❌ 부적합한 이슈 (반드시 skip 처리):
- 올림픽/월드컵/스포츠 경기 결과, 메달 소식 (피겨스케이팅, 스키점프 등 모두 포함)
- 일본이 아닌 다른 나라 이야기 (이탈리아, 밀라노, 코르티나 등)
- 일본 정치/국회/외교/선거
- 일본 연예인/방송/드라마
- 일본 기업 실적/주가
- 한국인 여행자가 일본에서 체감할 수 없는 이슈

[응답 형식]

부적합하면:
{{"skip": true, "reason": "스킵 사유"}}

적합하면 (반드시 한국어로 작성):
{{
  "skip": false,
  "relevance": {{
    "impact": "상/중/하",
    "interest": "상/중/하",
    "appeal": "매력 포인트 한 줄 (한국어)"
  }},
  "thumbnail_title": "메인 타이틀 16자 이내 (한국어, 이모지 포함)",
  "cards": [
    {{"title": "카드1 제목 12자내 (한국어)", "content": "카드1 내용 50자내 (한국어)"}},
    {{"title": "카드2 제목 (한국어)", "content": "카드2 내용 (한국어)"}},
    {{"title": "카드3 제목 (한국어)", "content": "카드3 내용 (한국어)"}},
    {{"title": "카드4 제목 (한국어)", "content": "카드4 내용 (한국어)"}}
  ],
  "caption": "인스타그램 본문 (한국어, 아래 형식 필수):\n# 제목\n도입부 2-3줄\n\n# 핵심정보1 제목\n상세 내용\n\n# 핵심정보2 제목\n상세 내용\n\n📌 저장해두고 친구한테도 공유해주세요!\n\n🙌🏻 일본 여행 정보 더 보고 싶다면?\n✔️ @flyingjapan 팔로우하기!\n✔️ 댓글에 'XX' 남겨주세요\n\nDM으로 관련 정보 보내드려요 💙",
  "hashtags": ["#일본여행", "#플라잉재팬", ... 총 15개],
  "image_keyword": "영어 키워드"
}}

JSON만 출력하세요."""

    try:
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            headers={'Content-Type': 'application/json'},
            json={
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {
                    'temperature': 0.7,
                    'maxOutputTokens': 2048,
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
                # AI가 부적합 판단한 경우
                if content.get('skip'):
                    print(f"⏭️ Skipped: {content.get('reason', '여행자 관련성 낮음')}")
                    return None
                return content
        else:
            print(f"❌ Gemma API error: {response.status_code} - {response.text[:200]}")

    except Exception as e:
        print(f"❌ Error generating content: {e}")

    return None

def create_plan_from_news(news: Dict, content: Dict) -> Dict:
    """뉴스와 AI 콘텐츠로 기획 객체 생성 (content는 반드시 유효한 AI 응답이어야 함)"""
    category = categorize_news(news)
    plan_id = f"plan_{hashlib.md5(news['title'].encode()).hexdigest()[:8]}"

    image_keyword = content.get('image_keyword', 'japan travel')

    # relevance 정보 (AI가 평가한 여행자 관련성)
    relevance = content.get('relevance', {})

    return {
        'id': plan_id,
        'created_at': datetime.now().isoformat(),
        'category': category,
        'priority': 'high' if relevance.get('impact') == '상' else ('medium' if relevance.get('impact') == '중' else 'low'),
        'status': 'new',
        'source': {
            'title': news['title'],
            'url': news['link'],
            'date': news.get('published', datetime.now().strftime('%Y-%m-%d'))
        },
        'relevance': {
            'impact': relevance.get('impact', '-'),
            'interest': relevance.get('interest', '-'),
            'appeal': relevance.get('appeal', '')
        },
        'content': {
            'thumbnail_title': content.get('thumbnail_title', ''),
            'cards': content.get('cards', []),
            'caption': content.get('caption', ''),
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

        # AI가 skip (None 반환) 하면 plan 생성하지 않음
        if content is None:
            print(f"⏭️ Not creating plan (AI skipped or no API key)")
            continue

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
