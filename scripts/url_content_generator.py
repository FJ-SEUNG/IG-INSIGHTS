#!/usr/bin/env python3
"""
URL Content Generator
사용자가 입력한 URL에서 콘텐츠를 추출하고 AI로 콘텐츠 기획을 생성합니다.
"""

import os
import json
import re
import hashlib
import requests
from datetime import datetime
from typing import Optional, Dict
from bs4 import BeautifulSoup

# YouTube 자막 추출 (선택적)
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    YOUTUBE_AVAILABLE = True
except ImportError:
    YOUTUBE_AVAILABLE = False

# ═══════════════════════════════════════════════════════════════
# 설정
# ═══════════════════════════════════════════════════════════════

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent"
INPUT_URL = os.environ.get('INPUT_URL', '')
PLANS_FILE = 'docs/data/content_plans.json'

# ═══════════════════════════════════════════════════════════════
# URL 콘텐츠 추출
# ═══════════════════════════════════════════════════════════════

def extract_youtube_id(url: str) -> Optional[str]:
    """YouTube URL에서 비디오 ID 추출"""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/shorts/([a-zA-Z0-9_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_youtube_content(url: str) -> Optional[Dict]:
    """YouTube 영상에서 제목과 자막 추출"""
    video_id = extract_youtube_id(url)
    if not video_id:
        return None

    # YouTube oEmbed API로 제목 가져오기
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        response = requests.get(oembed_url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            title = data.get('title', '')
        else:
            title = ''
    except:
        title = ''

    # 자막 추출 시도
    transcript_text = ''
    if YOUTUBE_AVAILABLE:
        try:
            # 한국어 > 일본어 > 영어 순으로 시도
            for lang in ['ko', 'ja', 'en']:
                try:
                    transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=[lang])
                    transcript_text = ' '.join([t['text'] for t in transcript[:50]])  # 처음 50개만
                    break
                except:
                    continue
        except:
            pass

    if not title and not transcript_text:
        return None

    return {
        'title': title,
        'content': transcript_text[:2000] if transcript_text else title,
        'source': 'YouTube',
        'url': url
    }

def get_webpage_content(url: str) -> Optional[Dict]:
    """웹페이지에서 제목과 본문 추출"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.encoding = response.apparent_encoding

        soup = BeautifulSoup(response.text, 'html.parser')

        # 제목 추출
        title = ''
        if soup.find('h1'):
            title = soup.find('h1').get_text(strip=True)
        elif soup.find('title'):
            title = soup.find('title').get_text(strip=True)

        # 본문 추출 (article, main, 또는 p 태그들)
        content = ''
        article = soup.find('article') or soup.find('main') or soup.find('div', class_=re.compile(r'content|article|post'))

        if article:
            paragraphs = article.find_all('p')
            content = ' '.join([p.get_text(strip=True) for p in paragraphs[:20]])
        else:
            paragraphs = soup.find_all('p')
            content = ' '.join([p.get_text(strip=True) for p in paragraphs[:15]])

        if not title and not content:
            return None

        return {
            'title': title[:200],
            'content': content[:2000],
            'source': url.split('/')[2],  # 도메인 추출
            'url': url
        }
    except Exception as e:
        print(f"❌ Error fetching URL: {e}")
        return None

def extract_content_from_url(url: str) -> Optional[Dict]:
    """URL에서 콘텐츠 추출 (YouTube 또는 웹페이지)"""
    if 'youtube.com' in url or 'youtu.be' in url:
        return get_youtube_content(url)
    else:
        return get_webpage_content(url)

# ═══════════════════════════════════════════════════════════════
# AI 콘텐츠 생성
# ═══════════════════════════════════════════════════════════════

def generate_content_with_ai(content_data: Dict) -> Optional[Dict]:
    """AI로 콘텐츠 기획 생성"""
    if not GEMINI_API_KEY:
        print("⚠️ GEMINI_API_KEY not set")
        return None

    prompt = f"""당신은 "한국인 일본 여행자 대상 인스타그램 콘텐츠 기획자"입니다.
목표: 한국에서 일본으로 여행 오는 한국인 여행자에게 실질적으로 도움이 되는 정보를 콘텐츠로 제작합니다.

⚠️ 중요 규칙:
1. 모든 콘텐츠는 반드시 "한국어"로 작성하세요 (일본어 사용 금지)
2. 외부 사이트/출처 언급 금지! (원본 출처를 언급하지 마세요)
3. 사용자가 제공한 URL 콘텐츠를 바탕으로 여행자에게 유용한 콘텐츠를 만드세요

[콘텐츠 정보]
제목: {content_data['title']}
내용: {content_data['content']}
출처: {content_data['source']}

[응답 형식]
반드시 한국어로 작성:
{{
  "category": "transport/season/hotplace/tips/event/breaking 중 하나",
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
  "caption": "인스타그램 본문 (한국어, 아래 형식 필수):\\n# 제목\\n도입부 2-3줄\\n\\n# 핵심정보1 제목\\n상세 내용\\n\\n# 핵심정보2 제목\\n상세 내용\\n\\n📌 저장해두고 친구한테도 공유해주세요!\\n\\n🙌🏻 일본 여행 정보 더 보고 싶다면?\\n✔️ @flyingjapan 팔로우하기!\\n✔️ 댓글에 'XX' 남겨주세요\\n\\nDM으로 관련 정보 보내드려요 💙",
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
                return json.loads(json_match.group())
        else:
            print(f"❌ AI API error: {response.status_code}")

    except Exception as e:
        print(f"❌ Error generating content: {e}")

    return None

def create_plan(content_data: Dict, ai_content: Dict) -> Dict:
    """콘텐츠 기획 객체 생성"""
    plan_id = f"url_{hashlib.md5(content_data['url'].encode()).hexdigest()[:8]}"

    image_keyword = ai_content.get('image_keyword', 'japan travel')
    category = ai_content.get('category', 'tips')

    return {
        'id': plan_id,
        'created_at': datetime.now().isoformat(),
        'category': category,
        'priority': 'high',
        'status': 'new',
        'source': {
            'title': content_data['title'],
            'url': content_data['url'],
            'date': datetime.now().strftime('%Y-%m-%d')
        },
        'relevance': ai_content.get('relevance', {
            'impact': '중',
            'interest': '중',
            'appeal': '사용자 요청 콘텐츠'
        }),
        'content': {
            'thumbnail_title': ai_content.get('thumbnail_title', ''),
            'cards': ai_content.get('cards', []),
            'caption': ai_content.get('caption', ''),
            'hashtags': ai_content.get('hashtags', [])
        },
        'image': {
            'keyword': image_keyword,
            'unsplash_url': f"https://unsplash.com/s/photos/{image_keyword.replace(' ', '-')}",
            'pexels_url': f"https://www.pexels.com/search/{image_keyword.replace(' ', '%20')}/"
        }
    }

def save_plan(plan: Dict):
    """기획을 JSON 파일에 저장"""
    try:
        with open(PLANS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except:
        data = {'last_updated': '', 'plans': []}

    # 중복 체크
    existing_ids = [p['id'] for p in data['plans']]
    if plan['id'] not in existing_ids:
        data['plans'].insert(0, plan)  # 맨 앞에 추가
        data['last_updated'] = datetime.now().isoformat()

        with open(PLANS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"✅ Saved: {plan['content']['thumbnail_title']}")
    else:
        print(f"⏭️ Already exists: {plan['id']}")

# ═══════════════════════════════════════════════════════════════
# 메인
# ═══════════════════════════════════════════════════════════════

def main():
    if not INPUT_URL:
        print("❌ No URL provided")
        return

    print(f"🔗 Processing URL: {INPUT_URL}")

    # 1. URL에서 콘텐츠 추출
    content_data = extract_content_from_url(INPUT_URL)
    if not content_data:
        print("❌ Failed to extract content from URL")
        return

    print(f"📄 Extracted: {content_data['title'][:50]}...")

    # 2. AI로 콘텐츠 생성
    ai_content = generate_content_with_ai(content_data)
    if not ai_content:
        print("❌ Failed to generate AI content")
        return

    print(f"🤖 Generated: {ai_content.get('thumbnail_title', 'Unknown')}")

    # 3. 기획 저장
    plan = create_plan(content_data, ai_content)
    save_plan(plan)

    print("✅ Done!")

if __name__ == '__main__':
    main()
