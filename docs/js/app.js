/* ── IG 인사이트 대시보드 ── */

// ── Gemini AI API (Gemma 모델 - 무료) ──
const GEMINI_API_KEY = 'AIzaSyAL6kD1f-77thu--7FPBY-dMCa_I2F7i00';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent';

// ── URL 콘텐츠 생성 함수 ──
async function generateContentFromUrl(url) {
  // 1. URL에서 콘텐츠 추출 (CORS 프록시 사용)
  const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);

  let title = '';
  let content = '';
  let source = new URL(url).hostname;

  try {
    const response = await fetch(proxyUrl, { timeout: 15000 });
    const html = await response.text();

    // 간단한 HTML 파싱
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 제목 추출
    const h1 = doc.querySelector('h1');
    const titleTag = doc.querySelector('title');
    title = h1?.textContent?.trim() || titleTag?.textContent?.trim() || '';

    // 본문 추출 (article, main, 또는 p 태그들)
    const article = doc.querySelector('article') || doc.querySelector('main');
    if (article) {
      const paragraphs = article.querySelectorAll('p');
      content = Array.from(paragraphs).slice(0, 10).map(p => p.textContent?.trim()).join(' ');
    } else {
      const paragraphs = doc.querySelectorAll('p');
      content = Array.from(paragraphs).slice(0, 8).map(p => p.textContent?.trim()).join(' ');
    }

    // 콘텐츠가 너무 짧으면 meta description 사용
    if (content.length < 100) {
      const metaDesc = doc.querySelector('meta[name="description"]');
      if (metaDesc) content = metaDesc.getAttribute('content') || content;
    }
  } catch (e) {
    console.error('URL fetch error:', e);
    // 프록시 실패 시 제목만 URL에서 추출
    title = url;
  }

  if (!title && !content) {
    throw new Error('URL에서 콘텐츠를 추출할 수 없습니다');
  }

  // 2. Gemini API로 콘텐츠 생성
  const prompt = `당신은 "한국인 일본 여행자 대상 인스타그램 콘텐츠 기획자"입니다.

⚠️ 중요 규칙:
1. 모든 콘텐츠는 반드시 "한국어"로 작성하세요
2. 외부 사이트/출처 언급 금지!
3. 제공된 정보를 바탕으로 여행자에게 유용한 콘텐츠를 만드세요

📌 인스타그램 카드뉴스 구조 이해 (매우 중요!)
- 카드뉴스 = 슬라이드로 넘기면서 보는 이미지들 → 여기에 "상세 정보" 담기
- 본문(caption) = 피드에서 바로 보이는 텍스트 → "요약/도입부" 역할

[카드뉴스 작성 규칙]
- 카드 제목: 최대 8자 이내
- 카드 내용: 구체적인 상세 정보! (소요시간, 가격, 장소, 방법, 날짜 등)
- 각 카드가 독립적인 정보 단위가 되도록 작성
- 예시: "하루카 특급" → "75분 소요, 3,430엔, 텐노지/신오사카 직통"

[본문(caption) 작성 규칙]
- 짧고 임팩트있는 도입부로 관심 유도
- 카드를 넘겨보게 만드는 요약 문구
- 상세 정보는 카드에 있으니 본문은 간결하게!
- CTA(Call-to-Action)와 해시태그 포함

[콘텐츠 정보]
제목: ${title.substring(0, 200)}
내용: ${content.substring(0, 1500)}
출처: ${source}

[응답 형식]
반드시 한국어로 JSON 형식으로만 응답:
{
  "category": "다음 중 정확히 하나만 선택: transport, season, hotplace, tips, event, breaking",
  "relevance": {
    "impact": "상/중/하",
    "interest": "상/중/하",
    "appeal": "매력 포인트 한 줄"
  },
  "thumbnail_title": "메인 타이틀 16자 이내 (이모지 포함)",
  "cards": [
    {"title": "8자 이내", "content": "구체적 상세 정보 (시간, 가격, 방법 등)"},
    {"title": "8자 이내", "content": "구체적 상세 정보"},
    {"title": "8자 이내", "content": "구체적 상세 정보"},
    {"title": "8자 이내", "content": "구체적 상세 정보"}
  ],
  "caption": "# 임팩트있는 제목 🎯\\n\\n한 줄 요약으로 관심 유도!\\n\\n👆 카드 넘겨서 자세한 정보 확인하세요\\n\\n📌 저장해두면 여행할 때 유용해요!\\n\\n🙌🏻 일본 여행 정보 더 보고 싶다면?\\n✔️ @flyingjapan 팔로우하기!\\n✔️ 댓글에 '정보' 남겨주세요\\n\\nDM으로 정보 보내드려요 💙",
  "hashtags": ["#일본여행", "#플라잉재팬", "... 총 15개"],
  "image_keyword": "영어 키워드"
}

JSON만 출력하세요.`;

  const aiResponse = await fetch(GEMINI_API_URL + '?key=' + GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });

  if (!aiResponse.ok) {
    throw new Error('AI API 호출 실패: ' + aiResponse.status);
  }

  const aiData = await aiResponse.json();
  const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // JSON 추출
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');
  }

  const aiContent = JSON.parse(jsonMatch[0]);
  const imageKeyword = aiContent.image_keyword || 'japan travel';

  // 카테고리 검증 및 보정
  const validCategories = ['transport', 'season', 'hotplace', 'tips', 'event', 'breaking'];
  let category = (aiContent.category || 'tips').toLowerCase().trim();

  // "season/hotplace" 같은 경우 첫 번째 값만 사용
  if (category.includes('/')) {
    category = category.split('/')[0].trim();
  }

  // 유효하지 않은 카테고리면 기본값 사용
  if (!validCategories.includes(category)) {
    category = 'tips';
  }

  // 3. Plan 객체 생성
  const planId = 'url_' + Date.now().toString(36);
  return {
    id: planId,
    created_at: new Date().toISOString(),
    category: category,
    priority: 'high',
    status: 'new',
    source: {
      title: title.substring(0, 100),
      url: url,
      date: new Date().toISOString().split('T')[0]
    },
    relevance: aiContent.relevance || { impact: '중', interest: '중', appeal: '사용자 요청' },
    content: {
      thumbnail_title: aiContent.thumbnail_title || '',
      cards: aiContent.cards || [],
      caption: aiContent.caption || '',
      hashtags: aiContent.hashtags || []
    },
    image: {
      keyword: imageKeyword,
      unsplash_url: 'https://unsplash.com/s/photos/' + imageKeyword.replace(/ /g, '-'),
      pexels_url: 'https://www.pexels.com/search/' + imageKeyword.replace(/ /g, '%20') + '/'
    }
  };
}

// ── 텍스트 기반 콘텐츠 재창작 함수 ──
async function generateContentFromText(originalText) {
  if (!originalText || originalText.trim().length < 20) {
    throw new Error('텍스트가 너무 짧습니다. 최소 20자 이상 입력해주세요.');
  }

  const prompt = `당신은 "한국인 일본 여행자 대상 인스타그램 콘텐츠 기획자"입니다.

⚠️ 매우 중요한 규칙:
1. 원본 텍스트의 "핵심 정보"를 참고하되, 다른 표현과 화법으로 재창작하세요
2. 원본 문장을 그대로 복사하지 마세요! 같은 의미를 다른 문장으로 작성하세요
3. 모든 콘텐츠는 반드시 "한국어"로 작성하세요
4. 외부 사이트/출처/원본 계정 언급 절대 금지!
5. @flyingjapan 계정의 톤앤매너로 작성하세요

📌 인스타그램 카드뉴스 구조 이해 (매우 중요!)
- 카드뉴스 = 슬라이드로 넘기면서 보는 이미지들 → 여기에 "상세 정보" 담기
- 본문(caption) = 피드에서 바로 보이는 텍스트 → "요약/도입부" 역할

[카드뉴스 작성 규칙]
- 카드 제목: 최대 8자 이내
- 카드 내용: 구체적인 상세 정보! (소요시간, 가격, 장소, 방법 등)
- 각 카드가 독립적인 정보 단위가 되도록 작성
- 예시: "하루카 특급" → "75분 소요, 3,430엔, 난바/신오사카 직통"

[본문(caption) 작성 규칙]
- 짧고 임팩트있는 도입부로 관심 유도
- 카드를 넘겨보게 만드는 요약 문구
- 상세 정보는 카드에 있으니 본문은 간결하게!
- CTA(Call-to-Action)와 해시태그 포함

[원본 텍스트 (참고용)]
${originalText.substring(0, 2000)}

[응답 형식]
반드시 한국어로 JSON 형식으로만 응답:
{
  "category": "다음 중 정확히 하나만 선택: transport, season, hotplace, tips, event, breaking",
  "relevance": {
    "impact": "상/중/하",
    "interest": "상/중/하",
    "appeal": "매력 포인트 한 줄"
  },
  "thumbnail_title": "메인 타이틀 16자 이내 (이모지 포함)",
  "cards": [
    {"title": "8자 이내", "content": "구체적 상세 정보 (시간, 가격, 방법 등)"},
    {"title": "8자 이내", "content": "구체적 상세 정보"},
    {"title": "8자 이내", "content": "구체적 상세 정보"},
    {"title": "8자 이내", "content": "구체적 상세 정보"}
  ],
  "caption": "# 임팩트있는 제목 🎯\\n\\n한 줄 요약으로 관심 유도!\\n\\n👆 카드 넘겨서 자세한 정보 확인하세요\\n\\n📌 저장해두면 여행할 때 유용해요!\\n\\n🙌🏻 일본 여행 정보 더 보고 싶다면?\\n✔️ @flyingjapan 팔로우하기!\\n✔️ 댓글에 '정보' 남겨주세요\\n\\nDM으로 정보 보내드려요 💙",
  "hashtags": ["#일본여행", "#플라잉재팬", "... 총 15개"],
  "image_keyword": "영어 키워드"
}

JSON만 출력하세요.`;

  const aiResponse = await fetch(GEMINI_API_URL + '?key=' + GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 2048 }  // 더 높은 temperature로 창의적 출력
    })
  });

  if (!aiResponse.ok) {
    throw new Error('AI API 호출 실패: ' + aiResponse.status);
  }

  const aiData = await aiResponse.json();
  const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // JSON 추출
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');
  }

  const aiContent = JSON.parse(jsonMatch[0]);
  const imageKeyword = aiContent.image_keyword || 'japan travel';

  // 카테고리 검증 및 보정
  const validCategories = ['transport', 'season', 'hotplace', 'tips', 'event', 'breaking'];
  let category = (aiContent.category || 'tips').toLowerCase().trim();
  if (category.includes('/')) {
    category = category.split('/')[0].trim();
  }
  if (!validCategories.includes(category)) {
    category = 'tips';
  }

  // Plan 객체 생성
  const planId = 'text_' + Date.now().toString(36);
  return {
    id: planId,
    created_at: new Date().toISOString(),
    category: category,
    priority: 'high',
    status: 'new',
    source: {
      title: '텍스트 재창작',
      url: '',
      date: new Date().toISOString().split('T')[0]
    },
    relevance: aiContent.relevance || { impact: '중', interest: '중', appeal: '텍스트 기반 재창작' },
    content: {
      thumbnail_title: aiContent.thumbnail_title || '',
      cards: aiContent.cards || [],
      caption: aiContent.caption || '',
      hashtags: aiContent.hashtags || []
    },
    image: {
      keyword: imageKeyword,
      unsplash_url: 'https://unsplash.com/s/photos/' + imageKeyword.replace(/ /g, '-'),
      pexels_url: 'https://www.pexels.com/search/' + imageKeyword.replace(/ /g, '%20') + '/'
    }
  };
}

async function analyzeWithGemini(reportData) {
  const prompt = `당신은 인스타그램 마케팅 전문가입니다. 아래 데이터를 분석하고 보고서 양식에 맞게 JSON으로 응답해주세요.

## 분석 대상 기간: ${reportData.period}
## 운영 일수: ${reportData.daysDiff}일
## 콘텐츠 수: ${reportData.stats.count}개

## 주요 지표
- 총 도달: ${reportData.stats.totalReach.toLocaleString()}회
- 총 좋아요: ${reportData.stats.totalLikes.toLocaleString()}개
- 총 댓글: ${reportData.stats.totalComments.toLocaleString()}개
- 총 저장: ${reportData.stats.totalSaves.toLocaleString()}개
- 총 공유: ${reportData.stats.totalShares.toLocaleString()}회
- 평균 참여율: ${reportData.stats.avgEngRate.toFixed(2)}%

## 전체 계정 대비 기여도
- 도달: ${reportData.contribution.reach}%
- 댓글: ${reportData.contribution.comments}%
- 공유: ${reportData.contribution.shares}%

## 효율성 (1,000 도달당, 과거→현재)
- 댓글: ${reportData.beforeEfficiency.comments.toFixed(1)} → ${reportData.afterEfficiency.comments.toFixed(1)}개 (${reportData.efficiencyMultiplier.comments}배)
- 저장: ${reportData.beforeEfficiency.saves.toFixed(1)} → ${reportData.afterEfficiency.saves.toFixed(1)}개 (${reportData.efficiencyMultiplier.saves}배)
- 공유: ${reportData.beforeEfficiency.shares.toFixed(1)} → ${reportData.afterEfficiency.shares.toFixed(1)}개 (${reportData.efficiencyMultiplier.shares}배)

## TOP 콘텐츠
도달 TOP: ${reportData.topReach.map(p => p.title || '제목없음').join(', ')}
공유 TOP: ${reportData.topShares.map(p => p.title || '제목없음').join(', ')}
저장 TOP: ${reportData.topSaves.map(p => p.title || '제목없음').join(', ')}
저성과: ${reportData.lowPerf.map(p => p.title || '제목없음').join(', ')}

---
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요:

{
  "summary": "지난 운영 기간(N일) 동안 총 N개의 콘텐츠를 발행하며... (2-3문장 총평)",
  "performances": [
    {"title": "성과 제목1", "desc": "구체적 설명 (수치 포함)"},
    {"title": "성과 제목2", "desc": "구체적 설명"}
  ],
  "improvements": [
    {"title": "개선점 제목1", "desc": "구체적 설명"},
    {"title": "개선점 제목2", "desc": "구체적 설명"}
  ],
  "contentAnalysis": {
    "highReach": {"analysis": "도달형 콘텐츠 분석", "strategy": "전략 제안"},
    "highShare": {"analysis": "확산형 콘텐츠 분석", "strategy": "전략 제안"},
    "highSave": {"analysis": "저장형 콘텐츠 분석", "strategy": "전략 제안"},
    "lowPerf": {"analysis": "저성과 콘텐츠 분석", "strategy": "개선 전략"}
  },
  "nextActions": ["액션1", "액션2", "액션3", "액션4"]
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON 파싱 시도
    try {
      // JSON 부분만 추출 (```json ... ``` 또는 { ... } 형태)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('JSON 형식을 찾을 수 없습니다.');
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError, text);
      throw new Error('AI 응답 파싱 실패');
    }
  } catch (error) {
    console.error('Gemini API 오류:', error);
    throw error;
  }
}

// ── Utilities ──
const fmt = n => n == null ? '-' : n.toLocaleString('ko-KR');
const fmtNum = fmt; // 숫자 포맷 별칭
const fmtSafe = n => n == null ? '<span class="no-data" title="데이터 없음">-</span>' : n.toLocaleString('ko-KR');
const fmtCompact = n => {
  if (n == null) return '-';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 10_000) return (n / 1_000).toFixed(0) + 'K';
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('ko-KR');
};
// 테이블 숫자 표시 모드: true=K/M 축약, false=전체 숫자
let compactMode = (() => { try { const v = localStorage.getItem('compact-mode'); return v === 'true'; } catch(e) { return false; } })();
const fmtCell = n => compactMode ? fmtCompact(n) : fmt(n);
const fmtPct = n => n == null ? '-' : n.toFixed(1) + '%';
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const sum = arr => arr.reduce((a, b) => a + (b || 0), 0);
const chartColors = {
  accent: '#F77737', accent2: '#833AB4', blue: '#448aff',
  green: '#00c853', red: '#ff5252', yellow: '#ffd600',
  orange: '#ff9100', purple: '#7c4dff', pink: '#e91e63',
};
const typeLabel = t => ({ 'CAROUSEL_ALBUM': '캐러셀', 'VIDEO': '릴스', 'IMAGE': '이미지' }[t] || t);
const chartTheme = {
  chart: { background: 'transparent', foreColor: '#9499b3', fontFamily: 'Noto Sans KR, sans-serif' },
  grid: { borderColor: '#2e3247', strokeDashArray: 3 },
  tooltip: { theme: 'dark' },
};

// ── Daily Change Helpers ──
function getDailyChange(daily, field) {
  if (!daily || daily.length < 2) return null;
  const today = daily[daily.length - 1];
  const yesterday = daily[daily.length - 2];
  const cur = today[field], prev = yesterday[field];
  if (cur == null || prev == null) return null;
  return { change: cur - prev, prev };
}
function changeBadge(changeObj, isRate = false) {
  if (!changeObj) return '';
  const { change } = changeObj;
  if (change === 0) return '';
  const sign = change >= 0 ? '+' : '';
  const val = isRate ? (sign + change.toFixed(1) + '%p') : (sign + fmtCell(change));
  const cls = change >= 0 ? 'positive' : 'negative';
  return ` <span class="kpi-change ${cls}">${val}</span>`;
}

// ── 팔로우 유입 기간별 비교 (전일/전주/전월/전년) ──
// posts의 follows 필드를 기간별로 합산하여 비교
function calcFollowsChanges(posts, followers) {
  if (!posts || !posts.length) return null;

  // 날짜 파싱된 포스트 목록
  const dated = posts.map(p => ({ ...p, _d: parseUploadDate(p.upload_date) })).filter(p => p._d);
  if (!dated.length) return null;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dow = now.getDay();

  // 기간별 팔로우 유입 합산
  function sumFollows(startDate, endDate) {
    return dated.filter(p => p._d >= startDate && p._d < endDate)
      .reduce((s, p) => s + (p.follows || 0), 0);
  }

  function countPosts(startDate, endDate) {
    return dated.filter(p => p._d >= startDate && p._d < endDate).length;
  }

  const results = {};

  // 현재 팔로워 수 (followers.json에서)
  const latestF = followers && followers.length ? followers[followers.length - 1] : null;
  results.current = latestF ? (latestF.followers || 0) : null;

  // ── 전일 vs 오늘 ──
  const todayStart = new Date(y, m, d);
  const yesterdayStart = new Date(y, m, d - 1);
  const todayFollows = sumFollows(todayStart, new Date(y, m, d + 1));
  const yesterdayFollows = sumFollows(yesterdayStart, todayStart);
  if (countPosts(yesterdayStart, todayStart) > 0 || countPosts(todayStart, new Date(y, m, d + 1)) > 0) {
    results.daily = { current: todayFollows, prev: yesterdayFollows, change: todayFollows - yesterdayFollows, available: true, currentLabel: '오늘', prevLabel: '어제' };
  } else {
    // 데이터 없으면 followers.json 기반으로 전일 대비
    if (followers && followers.length >= 2) {
      const cur = followers[followers.length - 1].followers || 0;
      const prev = followers[followers.length - 2].followers || 0;
      results.daily = { current: cur, prev: prev, change: cur - prev, available: true, currentLabel: '오늘', prevLabel: '어제', isFollowerCount: true };
    } else {
      results.daily = { available: false };
    }
  }

  // ── 전주 vs 이번주 ──
  const thisMonday = new Date(y, m, d - ((dow + 6) % 7));
  const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
  const thisWeekFollows = sumFollows(thisMonday, new Date(y, m, d + 1));
  const lastWeekFollows = sumFollows(lastMonday, thisMonday);
  if (countPosts(lastMonday, thisMonday) > 0 || countPosts(thisMonday, new Date(y, m, d + 1)) > 0) {
    results.weekly = { current: thisWeekFollows, prev: lastWeekFollows, change: thisWeekFollows - lastWeekFollows, available: true, currentLabel: '이번주', prevLabel: '지난주' };
  } else { results.weekly = { available: false }; }

  // ── 전월 vs 이번달 ──
  const thisMonth1st = new Date(y, m, 1);
  const lastMonth1st = new Date(y, m - 1, 1);
  const thisMonthFollows = sumFollows(thisMonth1st, new Date(y, m, d + 1));
  const lastMonthFollows = sumFollows(lastMonth1st, thisMonth1st);
  if (countPosts(lastMonth1st, thisMonth1st) > 0 || countPosts(thisMonth1st, new Date(y, m, d + 1)) > 0) {
    results.monthly = { current: thisMonthFollows, prev: lastMonthFollows, change: thisMonthFollows - lastMonthFollows, available: true, currentLabel: `${m + 1}월`, prevLabel: `${m === 0 ? 12 : m}월` };
  } else { results.monthly = { available: false }; }

  // ── 전년 vs 올해 ──
  const thisYear1st = new Date(y, 0, 1);
  const lastYear1st = new Date(y - 1, 0, 1);
  const thisYearFollows = sumFollows(thisYear1st, new Date(y, m, d + 1));
  const lastYearFollows = sumFollows(lastYear1st, thisYear1st);
  if (countPosts(lastYear1st, thisYear1st) > 0 || countPosts(thisYear1st, new Date(y, m, d + 1)) > 0) {
    results.yearly = { current: thisYearFollows, prev: lastYearFollows, change: thisYearFollows - lastYearFollows, available: true, currentLabel: `${y}년`, prevLabel: `${y - 1}년` };
  } else { results.yearly = { available: false }; }

  return results;
}

function followChangeBadge(label, data) {
  if (!data || !data.available) return `<span class="fc-item fc-na"><span class="fc-label">${label}</span><span class="fc-val">—</span></span>`;
  const sign = data.change >= 0 ? '+' : '';
  const cls = data.change > 0 ? 'positive' : data.change < 0 ? 'negative' : '';
  const detail = data.isFollowerCount ? '' : `<span class="fc-detail">${data.prevLabel} ${fmt(data.prev)} → ${data.currentLabel} ${fmt(data.current)}</span>`;
  return `<span class="fc-item ${cls}"><span class="fc-label">${label}</span><span class="fc-val">${sign}${fmt(data.change)}</span>${detail}</span>`;
}

// ── 팔로워 상단 배너 ──
function renderFollowerBanner() {
  const banner = document.getElementById('follower-banner');
  if (!banner) return;
  const followers = DATA.followers || [];
  if (!followers.length) { banner.style.display = 'none'; return; }

  const latest = followers[followers.length - 1];
  const currentFollowers = latest.followers || 0;

  // 전일 대비 팔로워 변화
  let changeHtml = '';
  if (followers.length >= 2) {
    const prev = followers[followers.length - 2].followers || 0;
    const diff = currentFollowers - prev;
    const sign = diff >= 0 ? '+' : '';
    const cls = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';
    changeHtml = `<span class="fb-section-label">전일대비</span><span class="fc-item ${cls}"><span class="fc-val">${sign}${fmt(diff)}</span></span>`;
  }

  banner.style.display = '';
  banner.innerHTML =
    `<span class="fb-current">👥 팔로워 <strong>${fmt(currentFollowers)}</strong></span>` +
    (changeHtml ? `<span class="fb-divider">|</span>${changeHtml}` : '');
}

// ── Milestone Filter ──
const MILESTONE_DATE = new Date(2025, 11, 26); // 2025-12-26
let milestoneFilter = 'all'; // 'all' | 'before' | 'after'

// upload_date "26.02.03(화)" → Date 객체 (여기서 미리 정의, 아래에서도 사용)
function parseUploadDate(str) {
  const m = str.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  return m ? new Date(2000 + parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])) : null;
}

function filterByMilestone(posts) {
  if (milestoneFilter === 'all') return posts;
  return posts.filter(p => {
    const d = parseUploadDate(p.upload_date);
    if (!d) return false;
    return milestoneFilter === 'before' ? d < MILESTONE_DATE : d >= MILESTONE_DATE;
  });
}

function filterDailyByMilestone(daily) {
  if (milestoneFilter === 'all') return daily;
  return daily.filter(d => {
    if (!d.date) return milestoneFilter === 'all';
    // daily_report date format: "2026-01-20" or similar
    const dt = new Date(d.date);
    if (isNaN(dt)) return milestoneFilter === 'all';
    return milestoneFilter === 'before' ? dt < MILESTONE_DATE : dt >= MILESTONE_DATE;
  });
}

function filterFollowersByMilestone(followers) {
  if (milestoneFilter === 'all') return followers;
  return followers.filter(f => {
    // follower date format: "26.01.20(월)" same as upload_date
    const d = parseUploadDate(f.date);
    if (!d) return milestoneFilter === 'all';
    return milestoneFilter === 'before' ? d < MILESTONE_DATE : d >= MILESTONE_DATE;
  });
}

// ── Manual Input Data (릴스 프로필 지표 수동 입력) ──
const MANUAL_DATA_KEY = 'ig-insights-manual-data';

function getManualData() {
  try {
    const data = localStorage.getItem(MANUAL_DATA_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) { return {}; }
}

function saveManualData(url, data) {
  try {
    const all = getManualData();
    all[url] = { ...data, updated_at: new Date().toISOString() };
    localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(all));
  } catch (e) { console.warn('수동 데이터 저장 실패:', e); }
}

function applyManualData(posts) {
  const manual = getManualData();
  posts.forEach(p => {
    if (manual[p.url]) {
      const m = manual[p.url];
      if (m.profile_visits != null) p.profile_visits = m.profile_visits;
      if (m.profile_activity != null) p.profile_activity = m.profile_activity;
      if (m.follows != null) {
        p.follows = m.follows;
        p.follow_rate = (p.follows != null && p.reach > 0) ? +(p.follows / p.reach * 100).toFixed(2) : null;
      }
      p._hasManualData = true;
    }
  });
}

let currentManualEditPost = null;

function openManualInputModal(post) {
  currentManualEditPost = post;
  const modal = document.getElementById('manual-input-modal');
  const meta = document.getElementById('manual-input-meta');
  const manual = getManualData()[post.url] || {};

  meta.innerHTML = `<strong>${post.title || '(제목 없음)'}</strong><br>
    <span style="color:var(--text2)">${post.upload_date} · ${typeLabel(post.media_type)}</span>`;

  document.getElementById('manual-profile-visits').value = manual.profile_visits ?? post.profile_visits ?? '';
  document.getElementById('manual-profile-activity').value = manual.profile_activity ?? post.profile_activity ?? '';
  document.getElementById('manual-follows').value = manual.follows ?? post.follows ?? '';

  modal.style.display = 'flex';
}

function closeManualInputModal() {
  document.getElementById('manual-input-modal').style.display = 'none';
  currentManualEditPost = null;
}

function saveManualInput() {
  if (!currentManualEditPost) return;

  const profileVisits = parseInt(document.getElementById('manual-profile-visits').value) || 0;
  const profileActivity = parseInt(document.getElementById('manual-profile-activity').value) || 0;
  const follows = parseInt(document.getElementById('manual-follows').value) || 0;

  saveManualData(currentManualEditPost.url, {
    profile_visits: profileVisits,
    profile_activity: profileActivity,
    follows: follows
  });

  // DATA에 즉시 반영
  const post = DATA.posts.find(p => p.url === currentManualEditPost.url);
  if (post) {
    post.profile_visits = profileVisits;
    post.profile_activity = profileActivity;
    post.follows = follows;
    post.follow_rate = (follows != null && post.reach > 0) ? +(follows / post.reach * 100).toFixed(2) : null;
    post._hasManualData = true;
  }

  closeManualInputModal();

  // 테이블 새로고침
  if (window.postTable) {
    window.postTable.replaceData(recalcRankedData(filterByMilestone(DATA.posts), currentSortField, currentSortDir));
  }

  // KPI 업데이트
  renderKpiStats(document.getElementById('kpi-mode-dropdown').value);
}

function setupManualInputModal() {
  document.getElementById('manual-input-close').addEventListener('click', closeManualInputModal);
  document.getElementById('manual-input-cancel').addEventListener('click', closeManualInputModal);
  document.getElementById('manual-input-save').addEventListener('click', saveManualInput);
  document.getElementById('manual-input-modal').addEventListener('click', e => {
    if (e.target.id === 'manual-input-modal') closeManualInputModal();
  });
}

// ── Data Store ──
let DATA = { posts: [], followers: [], daily: [], meta: {}, postsYesterday: [] };

// ── Init ──
async function init() {
  try {
    const [posts, followers, daily, meta, postsYesterday] = await Promise.all([
      fetch('data/posts.json').then(r => r.json()),
      fetch('data/followers.json').then(r => r.json()),
      fetch('data/daily_report.json').then(r => r.json()),
      fetch('data/meta.json').then(r => r.json()),
      fetch('data/posts_yesterday.json').then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    // 비율 필드 정규화: 0.059 형태(소수)를 5.9 형태(퍼센트)로 통일
    const rateFields = ['avg_engagement_rate', 'avg_save_rate', 'avg_share_rate'];
    daily.forEach(d => {
      rateFields.forEach(f => {
        if (d[f] != null && d[f] < 1) d[f] = +(d[f] * 100).toFixed(2);
      });
    });

    // 팔로우 전환율 계산 (follows / reach × 100) — reach > 0 검증
    posts.forEach(p => {
      p.follow_rate = (p.follows != null && p.reach > 0) ? +(p.follows / p.reach * 100).toFixed(2) : null;
    });
    postsYesterday.forEach(p => {
      p.follow_rate = (p.follows != null && p.reach > 0) ? +(p.follows / p.reach * 100).toFixed(2) : null;
    });

    DATA = { posts, followers, daily, meta, postsYesterday };
    DATA._hasYesterday = postsYesterday.length > 0;

    // 수동 입력 데이터 병합 (릴스 프로필 지표)
    applyManualData(DATA.posts);

    document.getElementById('update-time').textContent = meta.updated_at_ko;
    document.getElementById('loading').classList.add('hidden');

    setupTabs();
    setupMilestoneFilter();
    setupManualInputModal();
    initReportModal();
    renderAll();
  } catch (e) {
    document.getElementById('loading').innerHTML = '<p>데이터 로딩 실패: ' + e.message + '</p>';
  }
}

// ── Tab Navigation ──
function switchToTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const tab = document.getElementById('tab-' + tabName);
  if (btn && tab) {
    btn.classList.add('active');
    tab.classList.add('active');
    window.location.hash = tabName;
    window.dispatchEvent(new Event('resize'));
  }
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchToTab(btn.dataset.tab);
    });
  });

  // 페이지 로드 시 URL 해시에서 탭 복원
  const hash = window.location.hash.slice(1);
  if (hash) {
    switchToTab(hash);
  }

  // 브라우저 뒤로가기/앞으로가기 지원
  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.slice(1);
    if (newHash) switchToTab(newHash);
  });
}

// ── Milestone Filter Setup ──
function setupMilestoneFilter() {
  const toggle = document.getElementById('milestone-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', e => {
    const btn = e.target.closest('.milestone-btn');
    if (!btn || !btn.dataset.filter) return;
    milestoneFilter = btn.dataset.filter;
    toggle.querySelectorAll('.milestone-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Destroy existing charts & tables, then re-render everything
    destroyAllCharts();
    renderAll();
  });
}

// ── Destroy all charts before re-rendering ──
let chartInstances = [];
function trackChart(chart) { chartInstances.push(chart); return chart; }
function destroyAllCharts() {
  chartInstances.forEach(c => { try { c.destroy(); } catch(e) {} });
  chartInstances = [];
  if (dowChartInstance) { try { dowChartInstance.destroy(); } catch(e) {} dowChartInstance = null; }
  if (postTable) { try { postTable.destroy(); } catch(e) {} postTable = null; }
}

// ── Render All ──
function renderAll() {
  renderOverview();
  renderPostTable();
  renderFollowers();
  renderCategory();
  renderContent();
  renderFollowerBanner();
  // 전일 비교 데이터 안내
  const noticeEl = document.getElementById('no-yesterday-notice');
  if (noticeEl) {
    noticeEl.style.display = DATA._hasYesterday ? 'none' : 'flex';
  }
}

// ── KPI Stats (Unified with dropdown modes) ──
const statIds = ['posts','followers','reach','views','likes','saves','shares','comments','engagement','engagement_rate','save_rate','share_rate','follows','top_post'];
const statLabels = {
  posts: '게시물', followers: '팔로워', reach: '도달', views: '조회수',
  likes: '좋아요', saves: '저장', shares: '공유', comments: '댓글',
  engagement: '참여', engagement_rate: '참여율', save_rate: '저장율',
  share_rate: '공유율', follows: '팔로우 유입 (릴스제외)', top_post: 'TOP 게시물',
};
const statTooltips = {
  posts: '선택된 기간 내 업로드된 게시물의 총 개수',
  followers: '가장 최근 기록된 팔로워 수 (전일 대비 변화 포함)',
  reach: '게시물이 노출된 고유 계정 수의 합계 또는 평균',
  views: '게시물이 조회된 총 횟수 (중복 포함)',
  likes: '게시물에 달린 좋아요의 합계 또는 평균',
  saves: '사용자가 게시물을 저장한 횟수의 합계 또는 평균',
  shares: '게시물이 공유된 횟수의 합계 또는 평균',
  comments: '게시물에 달린 댓글의 합계 또는 평균',
  engagement: '좋아요 + 저장 + 공유 + 댓글의 합계 또는 평균',
  engagement_rate: '(참여 / 도달) × 100. 도달 대비 얼마나 반응했는지의 비율',
  save_rate: '(저장 / 도달) × 100. 콘텐츠를 저장할 만큼 가치를 느낀 비율',
  share_rate: '(공유 / 도달) × 100. 다른 사람에게 공유할 만큼 가치를 느낀 비율',
  follows: '게시물을 보고 팔로우한 수의 합계 또는 평균. Instagram API 특성상 릴스 데이터는 제외됨',
  top_post: '종합순위 1위 또는 도달 기준 가장 높은 게시물',
};

// ── Benchmark grading (Instagram industry averages) ──
// Each entry: { grades: [{min, label, cls}], unit, scaleNote }
// grades ordered from highest threshold downward
// 2025 Instagram benchmarks — 여행/관광 업종 기준
// Sources: Rival IQ 2025 Benchmark Report, Social Insider, Dash Social Travel Industry Report
const statBenchmarks = {
  engagement_rate: {
    grades: [
      { min: 3, label: '우수', cls: 'excellent' },
      { min: 1.2, label: '양호', cls: 'good' },
      { min: 0.5, label: '보통', cls: 'normal' },
      { min: 0, label: '미흡', cls: 'low' },
    ],
    unit: '%',
    scaleNote: '2025 IG 전체 평균 0.5%, 여행 업종 평균 약 1.2%. 3% 이상이면 매우 우수한 수준',
  },
  save_rate: {
    grades: [
      { min: 3, label: '우수', cls: 'excellent' },
      { min: 1, label: '양호', cls: 'good' },
      { min: 0.3, label: '보통', cls: 'normal' },
      { min: 0, label: '미흡', cls: 'low' },
    ],
    unit: '%',
    scaleNote: '캐러셀 평균 저장율 약 3.4%. 여행 콘텐츠는 저장율이 높은 편 (정보성 콘텐츠 +24%)',
  },
  share_rate: {
    grades: [
      { min: 1.5, label: '우수', cls: 'excellent' },
      { min: 0.5, label: '양호', cls: 'good' },
      { min: 0.2, label: '보통', cls: 'normal' },
      { min: 0, label: '미흡', cls: 'low' },
    ],
    unit: '%',
    scaleNote: '2025 IG 알고리즘이 DM 공유(Sends)를 최우선 순위로 반영. 공유율이 높을수록 도달 확대',
  },
};
// For marketer KPIs (not in statFields but rendered separately)
const marketerBenchmarks = {
  'kpi-avg-save-rate': statBenchmarks.save_rate,
  'kpi-avg-share-rate': statBenchmarks.share_rate,
  'kpi-avg-engagement-per-post': {
    grades: [
      { min: 300, label: '우수', cls: 'excellent' },
      { min: 100, label: '양호', cls: 'good' },
      { min: 30, label: '보통', cls: 'normal' },
      { min: 0, label: '미흡', cls: 'low' },
    ],
    unit: '',
    scaleNote: '팔로워 1만 이하 계정 기준. 팔로워 규모가 클수록 절대 수치는 높지만 비율은 낮아지는 경향',
  },
  'kpi-reach-rate': {
    grades: [
      { min: 150, label: '우수', cls: 'excellent' },
      { min: 50, label: '양호', cls: 'good' },
      { min: 20, label: '보통', cls: 'normal' },
      { min: 0, label: '미흡', cls: 'low' },
    ],
    unit: '%',
    scaleNote: '2025 IG 평균 도달율 약 20~30%. 50% 이상이면 양호, 100% 초과 시 비팔로워 유입 활발',
  },
};

function getGrade(benchmark, value) {
  if (value == null || !benchmark) return null;
  for (const g of benchmark.grades) {
    if (value >= g.min) return g;
  }
  return benchmark.grades[benchmark.grades.length - 1];
}

function gradeBadgeHtml(grade) {
  if (!grade) return '';
  return ` <span class="kpi-grade ${grade.cls}">${grade.label}</span>`;
}

function benchmarkScaleHtml(benchmark, currentValue) {
  if (!benchmark) return '';
  const grades = benchmark.grades;
  let html = '<div class="kpi-benchmark-scale">';
  html += '<div class="benchmark-title">여행 업종 기준 (2025)</div>';
  html += '<div class="benchmark-bar">';
  const colors = { excellent: '#00c853', good: '#448aff', normal: '#ffd600', low: '#ff5252' };
  const widths = [25, 25, 25, 25]; // equal width segments
  // Render segments (reversed: low→excellent, left to right)
  const reversed = [...grades].reverse();
  reversed.forEach((g, i) => {
    const nextMin = i < reversed.length - 1 ? reversed[i + 1].min : '';
    const label = g.min + (benchmark.unit || '') + (nextMin !== '' ? '' : '+');
    html += `<div class="benchmark-seg ${g.cls}" style="width:${widths[i]}%"><span class="seg-label">${g.label}</span></div>`;
  });
  html += '</div>';
  // Labels below
  html += '<div class="benchmark-labels">';
  reversed.forEach((g, i) => {
    html += `<span class="benchmark-val" style="width:${widths[i]}%">${g.min}${benchmark.unit}</span>`;
  });
  html += '</div>';
  if (benchmark.scaleNote) {
    html += `<div class="benchmark-note">${benchmark.scaleNote}</div>`;
  }
  html += '</div>';
  return html;
}

let visibleStats = new Set(statIds);
let currentKpiMode = 'total';

// Group posts by period helper
function groupPostsByPeriod(posts, mode, year, month, weekIdx) {
  if (mode === 'yearly') {
    const byYear = {};
    posts.forEach(p => {
      const d = parseUploadDate(p.upload_date);
      if (d) { const y = d.getFullYear(); if (!byYear[y]) byYear[y] = []; byYear[y].push(p); }
    });
    return year && byYear[year] ? byYear[year] : posts;
  }
  if (mode === 'monthly') {
    return posts.filter(p => {
      const d = parseUploadDate(p.upload_date);
      return d && d.getFullYear() === year && d.getMonth() === month;
    });
  }
  if (mode === 'weekly') {
    const weeks = getWeeksInMonth(year, month);
    const week = weeks[weekIdx];
    if (!week) return [];
    return posts.filter(p => {
      const d = parseUploadDate(p.upload_date);
      return d && d >= week.start && d <= week.endDate;
    });
  }
  if (mode === 'daily') {
    // Return posts for the specific day
    return posts.filter(p => {
      const d = parseUploadDate(p.upload_date);
      return d && d.getFullYear() === year && d.getMonth() === month && d.getDate() === weekIdx;
    });
  }
  return posts; // total, avg
}

function renderKpiStats(mode, periodPosts) {
  const posts = periodPosts || filterByMilestone(DATA.posts);
  const followers = filterFollowersByMilestone(DATA.followers);
  const daily = filterDailyByMilestone(DATA.daily);
  const isAvg = (mode === 'avg');
  const isTotal = (mode === 'total');
  const isPeriod = !isTotal && !isAvg; // yearly/monthly/weekly/daily

  // Build stat values
  const latestFollowers = followers.length ? followers[followers.length - 1].followers : null;
  const engRates = posts.map(p => p.engagement_rate).filter(v => v != null);
  const saveRates = posts.map(p => p.save_rate).filter(v => v != null);
  const shareRates = posts.map(p => p.share_rate).filter(v => v != null);

  const statFields = [
    { id: 'posts', val: posts.length, label: isPeriod ? '게시물 수' : '총 게시물' },
    { id: 'followers', val: latestFollowers, label: '현재 팔로워', noAvg: true },
    { id: 'reach',
      val: isAvg ? Math.round(avg(posts.map(p => p.reach).filter(v => v != null))) : sum(posts.map(p => p.reach)),
      label: isAvg ? '평균 도달' : '전체 도달', daily: 'total_reach' },
    { id: 'views',
      val: isAvg ? Math.round(avg(posts.map(p => p.views).filter(v => v != null))) : sum(posts.map(p => p.views)),
      label: isAvg ? '평균 조회수' : '전체 조회수', daily: 'total_views' },
    { id: 'likes',
      val: isAvg ? Math.round(avg(posts.map(p => p.likes).filter(v => v != null))) : sum(posts.map(p => p.likes)),
      label: isAvg ? '평균 좋아요' : '전체 좋아요', daily: 'total_likes' },
    { id: 'saves',
      val: isAvg ? Math.round(avg(posts.map(p => p.saves).filter(v => v != null))) : sum(posts.map(p => p.saves)),
      label: isAvg ? '평균 저장' : '전체 저장', daily: 'total_saves' },
    { id: 'shares',
      val: isAvg ? Math.round(avg(posts.map(p => p.shares).filter(v => v != null))) : sum(posts.map(p => p.shares)),
      label: isAvg ? '평균 공유' : '전체 공유', daily: 'total_shares' },
    { id: 'comments',
      val: isAvg ? Math.round(avg(posts.map(p => p.comments).filter(v => v != null))) : sum(posts.map(p => p.comments)),
      label: isAvg ? '평균 댓글' : '전체 댓글', daily: 'total_comments' },
    { id: 'engagement',
      val: isAvg ? Math.round(avg(posts.map(p => (p.likes||0)+(p.saves||0)+(p.shares||0)+(p.comments||0)))) : sum(posts.map(p => (p.likes||0)+(p.saves||0)+(p.shares||0)+(p.comments||0))),
      label: isAvg ? '평균 참여' : '전체 참여', daily: 'total_engagement' },
    { id: 'engagement_rate', val: engRates.length ? +avg(engRates).toFixed(1) : null, label: '평균 참여율', isPct: true, daily: 'avg_engagement_rate' },
    { id: 'save_rate', val: saveRates.length ? +avg(saveRates).toFixed(1) : null, label: '평균 저장율', isPct: true, daily: 'avg_save_rate' },
    { id: 'share_rate', val: shareRates.length ? +avg(shareRates).toFixed(1) : null, label: '평균 공유율', isPct: true, daily: 'avg_share_rate' },
    { id: 'follows',
      val: isAvg ? Math.round(avg(posts.map(p => p.follows || 0))) : sum(posts.map(p => p.follows || 0)),
      label: isAvg ? '평균 팔로우 유입 (릴스제외)' : '팔로우 유입 합계 (릴스제외)' },
    { id: 'top_post', val: null, label: 'TOP 게시물', isText: true },
  ];

  // Store for reference
  window._kpiStatFields = statFields;
  window._kpiDaily = daily;

  statFields.forEach(f => {
    const card = document.querySelector(`#kpi-stats-grid .kpi-card[data-stat="${f.id}"]`);
    const labelEl = document.getElementById(`kpi-stat-${f.id}-label`);
    const valueEl = document.getElementById(`kpi-total-${f.id}`);
    if (card) card.style.display = visibleStats.has(f.id) ? '' : 'none';
    if (labelEl) {
      const tooltip = statTooltips[f.id];
      const bm = statBenchmarks[f.id];
      const scaleHtml = benchmarkScaleHtml(bm, f.val);
      labelEl.innerHTML = f.label + (tooltip ? ` <span class="kpi-tooltip-wrap"><span class="kpi-tooltip-icon">ⓘ</span><span class="kpi-tooltip-text">${tooltip}${scaleHtml}</span></span>` : '');
    }

    if (f.id === 'top_post') {
      const top = posts.find(p => p.rank === 1) || (posts.length ? [...posts].sort((a,b) => (b.reach||0)-(a.reach||0))[0] : null);
      if (valueEl) {
        if (top) {
          valueEl.innerHTML = `<span title="종합순위 1위 (도달·참여·저장·공유 종합)">${top.title}</span>`;
        } else {
          valueEl.textContent = '-';
        }
      }
      if (labelEl) labelEl.innerHTML = 'TOP 게시물 <span class="kpi-tooltip-wrap"><span class="kpi-tooltip-icon">ⓘ</span><span class="kpi-tooltip-text">도달·참여·저장·공유를 종합한 순위 1위 게시물</span></span>';
      return;
    }
    if (f.id === 'followers') {
      if (valueEl) valueEl.textContent = fmt(f.val);
      // 전일 대비 팔로워 변화
      const changeEl = document.getElementById('kpi-followers-change');
      if (changeEl && followers.length >= 2) {
        const cur = followers[followers.length - 1].followers || 0;
        const prev = followers[followers.length - 2].followers || 0;
        const diff = cur - prev;
        const sign = diff >= 0 ? '+' : '';
        const cls = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';
        changeEl.innerHTML = `<span class="change-badge ${cls}">${sign}${fmt(diff)} 전일대비</span>`;
      } else if (changeEl) {
        changeEl.innerHTML = '';
      }
      return;
    }
    if (valueEl) {
      const formatted = f.isPct ? fmtPct(f.val) : fmtCell(f.val);
      const fullNum = f.isPct ? fmtPct(f.val) : fmt(f.val);
      const showChange = isTotal && f.daily;
      const bm = statBenchmarks[f.id];
      const grade = getGrade(bm, f.val);
      let changeHtml = showChange ? changeBadge(getDailyChange(daily, f.daily), f.isPct) : '';

      // follows 전일 대비: postsYesterday와 비교
      if (f.id === 'follows' && isTotal && DATA.postsYesterday && DATA.postsYesterday.length) {
        const yesterdayFollows = sum(DATA.postsYesterday.map(p => p.follows || 0));
        const diff = f.val - yesterdayFollows;
        if (diff !== 0) {
          const sign = diff >= 0 ? '+' : '';
          const cls = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';
          changeHtml = `<span class="change-badge ${cls}">${sign}${fmt(diff)}</span>`;
        }
      }

      valueEl.innerHTML = `<span title="${fullNum}">${formatted}</span>` + gradeBadgeHtml(grade) + changeHtml;
    }
  });
}

// Period selector UI for dropdown modes
function updateKpiPeriodSelectors(mode) {
  const container = document.getElementById('kpi-period-selectors');
  container.innerHTML = '';
  if (mode === 'total' || mode === 'avg') return;

  const posts = filterByMilestone(DATA.posts);
  const yms = getAvailableYearMonths();
  if (!yms.length) return;

  const latest = yms[0].split('-');
  const years = [...new Set(yms.map(ym => ym.split('-')[0]))];

  // Year selector
  const yearSel = document.createElement('select');
  yearSel.id = 'kpi-year';
  years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y + '년'; yearSel.appendChild(o); });
  yearSel.value = latest[0];
  container.appendChild(yearSel);

  if (mode === 'yearly') {
    yearSel.addEventListener('change', () => refreshKpiForPeriod());
    refreshKpiForPeriod();
    return;
  }

  // Month selector
  const monthSel = document.createElement('select');
  monthSel.id = 'kpi-month';
  const populateMonths = () => {
    monthSel.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const key = `${yearSel.value}-${String(m).padStart(2,'0')}`;
      if (yms.includes(key)) { const o = document.createElement('option'); o.value = m; o.textContent = m + '월'; monthSel.appendChild(o); }
    }
    const lastOpt = monthSel.options[monthSel.options.length - 1];
    if (lastOpt) monthSel.value = lastOpt.value;
  };
  populateMonths();
  container.appendChild(monthSel);

  if (mode === 'weekly') {
    const addWeekSel = () => {
      const old = document.getElementById('kpi-week');
      if (old) old.remove();
      const y = parseInt(yearSel.value);
      const m = parseInt(monthSel.value) - 1;
      const weeks = getWeeksInMonth(y, m);
      const weekSel = document.createElement('select');
      weekSel.id = 'kpi-week';
      weeks.forEach((w, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${i+1}주 (${w.label})`; weekSel.appendChild(o); });
      weekSel.value = String(weeks.length - 1);
      container.appendChild(weekSel);
      weekSel.addEventListener('change', () => refreshKpiForPeriod());
    };
    addWeekSel();
    yearSel.addEventListener('change', () => { populateMonths(); addWeekSel(); refreshKpiForPeriod(); });
    monthSel.addEventListener('change', () => { addWeekSel(); refreshKpiForPeriod(); });
    refreshKpiForPeriod();
    return;
  }

  if (mode === 'daily') {
    const addDaySel = () => {
      const old = document.getElementById('kpi-day');
      if (old) old.remove();
      const y = parseInt(yearSel.value);
      const m = parseInt(monthSel.value) - 1;
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const daySel = document.createElement('select');
      daySel.id = 'kpi-day';
      const today = new Date();
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(y, m, d);
        if (dt <= today) {
          const dayChar = ['일','월','화','수','목','금','토'][dt.getDay()];
          const o = document.createElement('option');
          o.value = d;
          o.textContent = `${d}일 (${dayChar})`;
          daySel.appendChild(o);
        }
      }
      const lastOpt = daySel.options[daySel.options.length - 1];
      if (lastOpt) daySel.value = lastOpt.value;
      container.appendChild(daySel);
      daySel.addEventListener('change', () => refreshKpiForPeriod());
    };
    addDaySel();
    yearSel.addEventListener('change', () => { populateMonths(); addDaySel(); refreshKpiForPeriod(); });
    monthSel.addEventListener('change', () => { addDaySel(); refreshKpiForPeriod(); });
    refreshKpiForPeriod();
    return;
  }

  // monthly
  yearSel.addEventListener('change', () => { populateMonths(); refreshKpiForPeriod(); });
  monthSel.addEventListener('change', () => refreshKpiForPeriod());
  refreshKpiForPeriod();
}

function refreshKpiForPeriod() {
  const mode = currentKpiMode;
  const posts = filterByMilestone(DATA.posts);
  const yearEl = document.getElementById('kpi-year');
  const monthEl = document.getElementById('kpi-month');
  const weekEl = document.getElementById('kpi-week');
  const dayEl = document.getElementById('kpi-day');
  const year = yearEl ? parseInt(yearEl.value) : null;
  const month = monthEl ? parseInt(monthEl.value) - 1 : null;
  let periodIdx = 0;
  if (mode === 'weekly') periodIdx = weekEl ? parseInt(weekEl.value) : 0;
  if (mode === 'daily') periodIdx = dayEl ? parseInt(dayEl.value) : 1;
  const filtered = groupPostsByPeriod(posts, mode, year, month, periodIdx);
  renderKpiStats(mode, filtered);
}

// Stats column toggle UI
function renderStatsToggle() {
  const container = document.getElementById('stats-toggle-list');
  if (!container) return;
  container.innerHTML = '';
  statIds.forEach(id => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = visibleStats.has(id);
    cb.addEventListener('change', () => {
      if (cb.checked) visibleStats.add(id);
      else visibleStats.delete(id);
      refreshKpiForPeriod();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(statLabels[id] || id));
    container.appendChild(label);
  });
}

// KPI dropdown binding
document.getElementById('kpi-mode-dropdown')?.addEventListener('change', function() {
  currentKpiMode = this.value;
  if (this.value === 'total' || this.value === 'avg') {
    document.getElementById('kpi-period-selectors').innerHTML = '';
    renderKpiStats(this.value, filterByMilestone(DATA.posts));
  } else {
    updateKpiPeriodSelectors(this.value);
  }
});

// Stats toggle panel show/hide
document.getElementById('stats-toggle-btn')?.addEventListener('click', () => {
  const panel = document.getElementById('stats-toggle-panel');
  const btn = document.getElementById('stats-toggle-btn');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    btn.classList.add('active');
    renderStatsToggle();
  } else {
    panel.style.display = 'none';
    btn.classList.remove('active');
  }
});

// ── KPI Card Drag & Drop Reorder ──
function initKpiDragDrop() {
  const grid = document.getElementById('kpi-stats-grid');
  if (!grid) return;
  let dragEl = null;

  grid.addEventListener('dragstart', e => {
    const card = e.target.closest('.kpi-card');
    if (!card) return;
    dragEl = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });

  grid.addEventListener('dragend', e => {
    const card = e.target.closest('.kpi-card');
    if (card) card.classList.remove('dragging');
    grid.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('drag-over'));
    dragEl = null;
    // Save order to localStorage
    const order = [...grid.querySelectorAll('.kpi-card')].map(c => c.dataset.stat);
    try { localStorage.setItem('kpi-card-order', JSON.stringify(order)); } catch(e) {}
  });

  grid.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.kpi-card');
    if (card && card !== dragEl) {
      grid.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
    }
  });

  grid.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.kpi-card');
    if (!target || !dragEl || target === dragEl) return;
    // Determine position
    const cards = [...grid.querySelectorAll('.kpi-card')];
    const dragIdx = cards.indexOf(dragEl);
    const targetIdx = cards.indexOf(target);
    if (dragIdx < targetIdx) {
      target.after(dragEl);
    } else {
      target.before(dragEl);
    }
    target.classList.remove('drag-over');
  });

  // Make cards draggable & restore saved order
  grid.querySelectorAll('.kpi-card').forEach(c => c.setAttribute('draggable', 'true'));
  try {
    const saved = JSON.parse(localStorage.getItem('kpi-card-order'));
    if (saved && Array.isArray(saved)) {
      const cardMap = {};
      grid.querySelectorAll('.kpi-card').forEach(c => { cardMap[c.dataset.stat] = c; });
      saved.forEach(stat => {
        if (cardMap[stat]) grid.appendChild(cardMap[stat]);
      });
    }
  } catch(e) {}
}

// Init drag after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to let cards render first
  setTimeout(initKpiDragDrop, 500);
});

// ══════════════════════════════════════════════════
// TAB 1: Overview
// ══════════════════════════════════════════════════
function renderContribution() {
  const allPosts = DATA.posts;
  const afterPosts = allPosts.filter(p => {
    const d = parseUploadDate(p.upload_date);
    return d && d >= MILESTONE_DATE;
  });

  const metrics = [
    { key: 'comments', label: '댓글', color: '#ffd600' },
    { key: 'follows', label: '팔로우', color: '#E040FB' },
    { key: 'shares', label: '공유', color: '#F77737' },
    { key: 'saves', label: '저장', color: '#00c853' },
    { key: 'reach', label: '도달', color: '#448aff' },
    { key: 'likes', label: '좋아요', color: '#ff5252' },
    { key: 'views', label: '조회수', color: '#7c4dff' },
  ];

  const container = document.getElementById('contribution-grid');
  if (!container) return;
  container.innerHTML = '';

  // 기여도 계산
  const contribData = metrics.map(m => {
    const totalAll = sum(allPosts.map(p => p[m.key] || 0));
    const totalAfter = sum(afterPosts.map(p => p[m.key] || 0));
    const pct = totalAll > 0 ? (totalAfter / totalAll * 100) : 0;
    return { ...m, totalAll, totalAfter, pct };
  });

  // 상위 3개 강조
  const sortedByPct = [...contribData].sort((a, b) => b.pct - a.pct);
  const top3Keys = new Set(sortedByPct.slice(0, 3).map(d => d.key));

  // 상위 그룹(top3)과 나머지 그룹 분리
  const topGroup = contribData.filter(d => top3Keys.has(d.key)).sort((a, b) => b.pct - a.pct);
  const restGroup = contribData.filter(d => !top3Keys.has(d.key));

  // 상위 3개 큰 도넛
  const topRow = document.createElement('div');
  topRow.className = 'contrib-row contrib-row-top';
  container.appendChild(topRow);

  // 나머지 작은 도넛
  const restRow = document.createElement('div');
  restRow.className = 'contrib-row contrib-row-rest';
  container.appendChild(restRow);

  function renderDonut(d, parentEl, isTop) {
    const item = document.createElement('div');
    item.className = 'contrib-item' + (isTop ? ' contrib-highlight' : '');
    const chartId = `contrib-chart-${d.key}`;
    const rankIdx = sortedByPct.findIndex(s => s.key === d.key) + 1;
    const rankBadge = isTop ? `<span class="contrib-badge top">${rankIdx}위</span>` : '';

    item.innerHTML = `
      <div class="contrib-label">${d.label}</div>
      <div class="contrib-chart" id="${chartId}"></div>
      <div class="contrib-detail">${fmt(d.totalAfter)} / ${fmt(d.totalAll)}</div>
      ${rankBadge}
    `;
    parentEl.appendChild(item);

    const afterPct = +d.pct.toFixed(1);
    const beforePct = +(100 - afterPct).toFixed(1);
    const chartH = isTop ? 160 : 120;
    const fontSize = isTop ? '22px' : '16px';

    trackChart(new ApexCharts(document.getElementById(chartId), {
      series: [afterPct, beforePct],
      chart: { type: 'donut', height: chartH, sparkline: { enabled: true } },
      labels: ['담당 이후', '담당 이전'],
      colors: [d.color, 'rgba(46,50,71,0.4)'],
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              name: { show: false },
              value: { show: true, fontSize, fontWeight: 700,
                color: d.color,
                formatter: () => afterPct + '%'
              },
              total: { show: true, showAlways: true,
                fontSize, fontWeight: 700,
                color: d.color,
                formatter: () => afterPct + '%'
              }
            }
          }
        }
      },
      stroke: { show: false },
      tooltip: { enabled: true, theme: 'dark', y: { formatter: v => v + '%' } },
      legend: { show: false },
      states: { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } }
    })).render();
  }

  topGroup.forEach(d => renderDonut(d, topRow, true));
  restGroup.forEach(d => renderDonut(d, restRow, false));
}

function renderOverview() {
  const posts = filterByMilestone(DATA.posts);
  const followers = filterFollowersByMilestone(DATA.followers);
  const daily = filterDailyByMilestone(DATA.daily);

  // Unified KPI Stats
  const mode = currentKpiMode;
  if (mode === 'total' || mode === 'avg') {
    renderKpiStats(mode, posts);
  } else {
    updateKpiPeriodSelectors(mode);
  }

  // Follower trend mini sparkline (개요 탭 — 최근 데이터만 간략히)
  document.getElementById('chart-follower-trend').innerHTML = '';
  if (followers.length >= 2) {
    trackChart(new ApexCharts(document.getElementById('chart-follower-trend'), {
      ...chartTheme,
      series: [{ name: '팔로워', data: followers.map(f => f.followers) }],
      chart: { ...chartTheme.chart, type: 'area', height: 180, sparkline: { enabled: false } },
      xaxis: { categories: followers.map(f => f.date.replace(/\(.\)$/, '')), labels: { style: { fontSize: '10px' } } },
      yaxis: { labels: { formatter: v => fmt(v) }, min: Math.min(...followers.map(f=>f.followers)) - 5 },
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
      colors: [chartColors.accent],
      grid: chartTheme.grid,
      dataLabels: { enabled: true, formatter: v => fmt(v), style: { fontSize: '10px' } },
      tooltip: { ...chartTheme.tooltip, y: { formatter: v => fmt(v) + '명' } },
    })).render();
  } else {
    document.getElementById('chart-follower-trend').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:180px;color:#666;font-size:13px">팔로워 데이터 수집 중 (2일 이상 필요)</div>';
  }

  // Content type distribution donut
  const typeCounts = {};
  posts.forEach(p => { typeCounts[p.media_type] = (typeCounts[p.media_type] || 0) + 1; });
  document.getElementById('chart-type-dist').innerHTML = '';
  trackChart(new ApexCharts(document.getElementById('chart-type-dist'), {
    ...chartTheme,
    series: Object.values(typeCounts),
    chart: { ...chartTheme.chart, type: 'donut', height: 250 },
    labels: Object.keys(typeCounts).map(typeLabel),
    colors: [chartColors.accent, chartColors.blue, chartColors.green, chartColors.yellow],
    legend: { position: 'bottom', labels: { colors: '#9499b3' } },
    plotOptions: { pie: { donut: { size: '55%' } } },
  })).render();

  // Day-of-week reach & engagement (replaces daily chart)
  renderDowChart('all');

  // ── Marketer KPIs ──
  const mSaveRates = posts.map(p => p.save_rate).filter(v => v != null);
  const mShareRates = posts.map(p => p.share_rate).filter(v => v != null);
  const avgSaveRate = avg(mSaveRates);
  const avgShareRate = avg(mShareRates);
  document.getElementById('kpi-avg-save-rate').innerHTML = fmtPct(avgSaveRate) + gradeBadgeHtml(getGrade(marketerBenchmarks['kpi-avg-save-rate'], avgSaveRate)) + changeBadge(getDailyChange(daily, 'avg_save_rate'), true);
  document.getElementById('kpi-avg-share-rate').innerHTML = fmtPct(avgShareRate) + gradeBadgeHtml(getGrade(marketerBenchmarks['kpi-avg-share-rate'], avgShareRate)) + changeBadge(getDailyChange(daily, 'avg_share_rate'), true);

  const avgEngPerPost = posts.length ? Math.round(sum(posts.map(p => (p.likes||0)+(p.saves||0)+(p.shares||0)+(p.comments||0))) / posts.length) : 0;
  const engPerPostChange = daily.length >= 2 ? (() => {
    const d1 = daily[daily.length - 1], d0 = daily[daily.length - 2];
    if (d1.total_engagement && d1.post_count && d0.total_engagement && d0.post_count) {
      return { change: Math.round(d1.total_engagement / d1.post_count - d0.total_engagement / d0.post_count) };
    }
    return null;
  })() : null;
  document.getElementById('kpi-avg-engagement-per-post').innerHTML = `<span title="${fmt(avgEngPerPost)}">${fmtCell(avgEngPerPost)}</span>` + gradeBadgeHtml(getGrade(marketerBenchmarks['kpi-avg-engagement-per-post'], avgEngPerPost)) + changeBadge(engPerPostChange);

  const mReaches = posts.map(p => p.reach).filter(v => v != null);
  const mLatestFollowers = followers.length ? followers[followers.length - 1].followers : null;
  const reachRate = mLatestFollowers ? (avg(mReaches) / mLatestFollowers * 100) : 0;
  document.getElementById('kpi-reach-rate').innerHTML = fmtPct(reachRate) + gradeBadgeHtml(getGrade(marketerBenchmarks['kpi-reach-rate'], reachRate));

  // ── Contribution Analysis (운영 기여도) ──
  renderContribution();

  // ── Carousel vs Reels comparison ──
  const typeCompare = {};
  posts.forEach(p => {
    const t = p.media_type || 'OTHER';
    if (!typeCompare[t]) typeCompare[t] = { reach: [], eng: [], saves: [], shares: [], saveRate: [], shareRate: [] };
    const tc = typeCompare[t];
    if (p.reach) tc.reach.push(p.reach);
    if (p.engagement_rate) tc.eng.push(p.engagement_rate);
    if (p.saves) tc.saves.push(p.saves);
    if (p.shares) tc.shares.push(p.shares);
    if (p.save_rate) tc.saveRate.push(p.save_rate);
    if (p.share_rate) tc.shareRate.push(p.share_rate);
  });
  const tcLabels = Object.keys(typeCompare).map(typeLabel);
  const tcKeys = Object.keys(typeCompare);

  document.getElementById('chart-type-compare').innerHTML = '';
  trackChart(new ApexCharts(document.getElementById('chart-type-compare'), {
    ...chartTheme,
    series: [
      { name: '평균 참여율', data: tcKeys.map(k => +avg(typeCompare[k].eng).toFixed(1)) },
      { name: '평균 저장율', data: tcKeys.map(k => +avg(typeCompare[k].saveRate).toFixed(1)) },
      { name: '평균 공유율', data: tcKeys.map(k => +avg(typeCompare[k].shareRate).toFixed(1)) },
    ],
    chart: { ...chartTheme.chart, type: 'bar', height: 280 },
    xaxis: { categories: tcLabels },
    yaxis: { labels: { formatter: v => v + '%' } },
    colors: [chartColors.accent, chartColors.green, chartColors.orange],
    plotOptions: { bar: { borderRadius: 3, columnWidth: '50%' } },
    grid: chartTheme.grid,
    tooltip: { ...chartTheme.tooltip, y: { formatter: v => v + '%' } },
  })).render();
}

// ══════════════════════════════════════════════════
// TAB 2: Post Table
// ══════════════════════════════════════════════════
let postTable = null;
let currentSortField = 'rank';
let userColumnOrder = null; // 사용자가 드래그로 변경한 칼럼 순서 저장
let yesterdayMap = new Map();

// Build yesterday lookup map
function buildYesterdayMap() {
  yesterdayMap = new Map();
  (DATA.postsYesterday || []).forEach(p => {
    const key = p.url || p.title;
    if (key) yesterdayMap.set(key, p);
  });
}

// Format cell with change (compact or full numbers with tooltip)
function fmtWithChange(value, field, row) {
  if (value == null) return '-';
  const key = row.url || row.title;
  const prev = yesterdayMap.get(key);
  let html = `<span title="${fmt(value)}">${fmtCell(value)}</span>`;
  if (prev && prev[field] != null) {
    const diff = value - prev[field];
    if (diff !== 0) {
      const sign = diff > 0 ? '+' : '';
      const cls = diff > 0 ? 'positive' : 'negative';
      html += ` <span class="cell-change ${cls}">(${sign}${fmtCell(diff)})</span>`;
    }
  }
  return html;
}

// Column definitions factory
const colDef = {
  rank:       () => ({ title: '순위', field: '_rank', width: 60, hozAlign: 'center', sorter: 'number' }),
  upload_date:() => ({ title: '업로드일', field: 'upload_date', width: 110,
    sorter: (a, b) => {
      const da = parseUploadDate(a), db = parseUploadDate(b);
      if (!da && !db) return 0;
      if (!da) return -1;
      if (!db) return 1;
      return da - db;
    }}),
  media_type: () => ({ title: '유형', field: 'media_type', width: 80, hozAlign: 'center', formatter: cell => typeLabel(cell.getValue()) }),
  category:   () => ({ title: '카테고리', field: 'category', width: 90, hozAlign: 'center' }),
  title:      () => ({ title: '제목', field: 'title', minWidth: 180,
    formatter: cell => {
      const row = cell.getRow().getData();
      return row.url ? `<a href="${row.url}" target="_blank" style="color:#F77737;text-decoration:none">${cell.getValue()}</a>` : cell.getValue();
    }}),
  reach:      () => ({ title: '도달', field: 'reach', width: 100, hozAlign: 'right', sorter: 'number',
    formatter: cell => fmtWithChange(cell.getValue(), 'reach', cell.getRow().getData()) }),
  views:      () => ({ title: '조회수', field: 'views', width: 100, hozAlign: 'right', sorter: 'number',
    formatter: cell => fmtWithChange(cell.getValue(), 'views', cell.getRow().getData()) }),
  likes:      () => ({ title: '좋아요', field: 'likes', width: 90, hozAlign: 'right', sorter: 'number',
    formatter: cell => fmtWithChange(cell.getValue(), 'likes', cell.getRow().getData()) }),
  saves:      () => ({ title: '저장', field: 'saves', width: 85, hozAlign: 'right', sorter: 'number',
    formatter: cell => fmtWithChange(cell.getValue(), 'saves', cell.getRow().getData()) }),
  shares:     () => ({ title: '공유', field: 'shares', width: 85, hozAlign: 'right', sorter: 'number',
    formatter: cell => fmtWithChange(cell.getValue(), 'shares', cell.getRow().getData()) }),
  comments:   () => ({ title: '댓글', field: 'comments', width: 80, hozAlign: 'right', sorter: 'number',
    formatter: cell => fmtWithChange(cell.getValue(), 'comments', cell.getRow().getData()) }),
  engagement_rate: () => ({ title: '참여율', field: 'engagement_rate', width: 95, hozAlign: 'right', sorter: 'number',
    formatter: cell => {
      const v = cell.getValue();
      if (v == null) return '-';
      const color = v >= 5 ? '#00c853' : v >= 3 ? '#ffd600' : '#9499b3';
      const row = cell.getRow().getData();
      const key = row.url || row.title;
      const prev = yesterdayMap.get(key);
      let changeHtml = '';
      if (prev && prev.engagement_rate != null) {
        const diff = v - prev.engagement_rate;
        if (diff !== 0) {
          const sign = diff > 0 ? '+' : '';
          const cls = diff > 0 ? 'positive' : 'negative';
          changeHtml = ` <span class="cell-change ${cls}">(${sign}${diff.toFixed(1)})</span>`;
        }
      }
      return `<span style="color:${color}">${v.toFixed(1)}%</span>${changeHtml}`;
    }}),
  follows:    () => ({ title: '팔로우', field: 'follows', width: 100, hozAlign: 'right', sorter: 'number',
    formatter: (cell, formatterParams, onRendered) => {
      const row = cell.getRow().getData();
      const v = cell.getValue();
      const isVideo = row.media_type === 'VIDEO';
      const hasManual = row._hasManualData;
      let val = fmtWithChange(v, 'follows', row);
      if (hasManual) val += '<span class="manual-badge">수동</span>';
      if (isVideo) val += `<button class="manual-edit-btn" data-url="${row.url}" title="수동 입력">✏️</button>`;
      return val;
    }}),
  follow_rate: () => ({ title: '팔로우 전환율', field: 'follow_rate', width: 105, hozAlign: 'right', sorter: 'number',
    formatter: cell => {
      const v = cell.getValue();
      if (v == null) return '-';
      const color = v >= 1 ? '#00c853' : v >= 0.3 ? '#ffd600' : '#9499b3';
      return `<span style="color:${color}">${v.toFixed(2)}%</span>`;
    }}),
  composite_score: () => ({ title: '점수', field: 'composite_score', width: 65, hozAlign: 'right', sorter: 'number',
    formatter: cell => { const v = cell.getValue(); return v != null ? v.toFixed(1) : '-'; }}),
};

// Default column order
const defaultOrder = ['rank','upload_date','media_type','category','title','reach','views','likes','saves','shares','comments','follows','follow_rate','engagement_rate','composite_score'];

// Column toggle (visible columns)
const colLabels = {
  rank: '순위', upload_date: '업로드일', media_type: '유형', category: '카테고리',
  title: '제목', reach: '도달', views: '조회수', likes: '좋아요',
  saves: '저장', shares: '공유', comments: '댓글',
  follows: '팔로우', follow_rate: '팔로우 전환율',
  engagement_rate: '참여율', composite_score: '점수',
};
// title is always visible (non-toggleable)
let visibleColumns = new Set(defaultOrder);
// localStorage에서 칼럼 설정 복원
try {
  const savedVisible = JSON.parse(localStorage.getItem('col-visible'));
  if (savedVisible && Array.isArray(savedVisible)) visibleColumns = new Set(savedVisible);
  const savedOrder = JSON.parse(localStorage.getItem('col-order'));
  if (savedOrder && Array.isArray(savedOrder)) userColumnOrder = savedOrder;
} catch(e) {}

// Build columns respecting user's drag order
function buildColumns(sortField) {
  // 사용자가 드래그로 순서를 변경한 경우 그 순서 사용
  let order;
  if (userColumnOrder) {
    order = userColumnOrder.filter(key => visibleColumns.has(key));
    // 새로 추가된 칼럼이 있으면 끝에 추가
    visibleColumns.forEach(key => {
      if (!order.includes(key)) order.push(key);
    });
  } else {
    order = [...defaultOrder].filter(key => visibleColumns.has(key));
    const metricsFields = ['reach','views','likes','saves','shares','comments','follows','follow_rate','engagement_rate'];
    if (metricsFields.includes(sortField) && order.includes(sortField)) {
      const idx = order.indexOf(sortField);
      const titleIdx = order.indexOf('title');
      if (titleIdx >= 0 && idx > titleIdx + 1) {
        order.splice(idx, 1);
        order.splice(titleIdx + 1, 0, sortField);
      }
    }
  }
  return order.map(key => colDef[key]());
}

// 현재 테이블에서 칼럼 순서 저장
function saveColumnOrder() {
  if (!postTable) return;
  const cols = postTable.getColumns();
  userColumnOrder = cols.map(col => {
    const field = col.getField();
    if (field === '_rank') return 'rank';
    return field;
  }).filter(key => key && defaultOrder.includes(key));
  // localStorage에 칼럼 순서 + 표시 설정 저장
  try {
    localStorage.setItem('col-order', JSON.stringify(userColumnOrder));
    localStorage.setItem('col-visible', JSON.stringify([...visibleColumns]));
  } catch(e) {}
}

// Column toggle UI
function renderColumnToggle() {
  const container = document.getElementById('col-toggle-list');
  if (!container) return;
  container.innerHTML = '';
  defaultOrder.forEach(key => {
    if (key === 'title') return; // title은 항상 표시
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = visibleColumns.has(key);
    cb.dataset.col = key;
    cb.addEventListener('change', () => {
      // 칼럼 토글 전 현재 순서 저장
      saveColumnOrder();
      if (cb.checked) visibleColumns.add(key);
      else visibleColumns.delete(key);
      try { localStorage.setItem('col-visible', JSON.stringify([...visibleColumns])); } catch(e) {}
      if (postTable) {
        postTable.setColumns(buildColumns(currentSortField));
      }
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(colLabels[key] || key));
    container.appendChild(label);
  });
}

// Toggle panel show/hide
document.getElementById('col-toggle-btn')?.addEventListener('click', () => {
  const panel = document.getElementById('col-toggle-panel');
  const btn = document.getElementById('col-toggle-btn');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    btn.classList.add('active');
    renderColumnToggle();
  } else {
    panel.style.display = 'none';
    btn.classList.remove('active');
  }
});

// K/M ↔ 숫자 토글 버튼
document.getElementById('compact-toggle-btn')?.addEventListener('click', () => {
  compactMode = !compactMode;
  try { localStorage.setItem('compact-mode', String(compactMode)); } catch(e) {}
  const btn = document.getElementById('compact-toggle-btn');
  btn.classList.toggle('active', compactMode);
  btn.textContent = compactMode ? 'K/M' : '숫자';
  btn.title = compactMode ? '현재: K/M 축약 → 클릭하면 전체 숫자' : '현재: 전체 숫자 → 클릭하면 K/M 축약';
  // 게시물 테이블 셀 다시 그리기
  if (postTable) postTable.redraw(true);
  // KPI 카드 숫자 갱신 (차트 제외한 가벼운 업데이트)
  const posts = filterByMilestone(DATA.posts);
  const mode = currentKpiMode;
  if (mode === 'total' || mode === 'avg') renderKpiStats(mode, posts);
  // 카테고리 & 콘텐츠 탭 테이블 갱신
  renderCategory();
  renderContent();
});
// 버튼 초기 상태 반영 (localStorage에서 복원된 경우)
(() => {
  const btn = document.getElementById('compact-toggle-btn');
  if (btn) {
    btn.classList.toggle('active', compactMode);
    btn.textContent = compactMode ? 'K/M' : '숫자';
    btn.title = compactMode ? '현재: K/M 축약 → 클릭하면 전체 숫자' : '현재: 전체 숫자 → 클릭하면 K/M 축약';
  }
})();

// Recalculate rank based on sort field
function recalcRankedData(posts, sortField, sortDir) {
  const sorted = [...posts];
  if (sortField === 'rank') {
    // Use original composite rank
    sorted.sort((a, b) => (a.rank || 999) - (b.rank || 999));
  } else if (sortField === 'upload_date') {
    sorted.sort((a, b) => {
      const da = parseUploadDate(a.upload_date), db = parseUploadDate(b.upload_date);
      if (!da && !db) return 0;
      if (!da) return sortDir === 'desc' ? 1 : -1;
      if (!db) return sortDir === 'desc' ? -1 : 1;
      return sortDir === 'desc' ? db - da : da - db;
    });
  } else {
    sorted.sort((a, b) => sortDir === 'desc' ? (b[sortField] || 0) - (a[sortField] || 0) : (a[sortField] || 0) - (b[sortField] || 0));
  }
  return sorted.map((p, i) => ({ ...p, _rank: i + 1 }));
}

// ── Day-of-Week Chart ──
let dowChartInstance = null;
let dowCurrentMode = 'all';

// 게시물에서 사용 가능한 연도/월 목록 추출
function getAvailableYearMonths() {
  const ym = new Set();
  filterByMilestone(DATA.posts).forEach(p => {
    const d = parseUploadDate(p.upload_date);
    if (d) ym.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  });
  return [...ym].sort().reverse(); // 최신순
}

// ISO 주차 계산
function getWeekNumber(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// 특정 월의 주차 목록 생성
function getWeeksInMonth(year, month) {
  const weeks = new Map();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const dt = new Date(year, month, i);
    const wn = getWeekNumber(dt);
    if (!weeks.has(wn)) {
      const dayChar = ['일','월','화','수','목','금','토'][dt.getDay()];
      weeks.set(wn, { weekNum: wn, start: dt, label: `${i}일~` });
    }
  }
  // 라벨 보정: 시작일~종료일
  const result = [...weeks.values()];
  for (let i = 0; i < result.length; i++) {
    const next = i < result.length - 1 ? result[i + 1].start : new Date(year, month + 1, 0);
    const endDay = i < result.length - 1 ? new Date(next.getTime() - 86400000).getDate() : new Date(year, month + 1, 0).getDate();
    result[i].label = `${result[i].start.getDate()}일~${endDay}일`;
    result[i].endDate = new Date(year, month, endDay, 23, 59, 59);
  }
  return result;
}

// 셀렉터 UI 업데이트
function updateDowSelectors(mode, keepValues) {
  const container = document.getElementById('dow-selectors');
  const prevYear = keepValues ? document.getElementById('dow-year')?.value : null;
  const prevMonth = keepValues ? document.getElementById('dow-month')?.value : null;
  container.innerHTML = '';
  if (mode === 'all') return;

  const yms = getAvailableYearMonths();
  if (!yms.length) return;

  const latest = yms[0].split('-');
  const defYear = prevYear || latest[0];
  const years = [...new Set(yms.map(ym => ym.split('-')[0]))];

  // 년도 셀렉터
  const yearSel = document.createElement('select');
  yearSel.id = 'dow-year';
  years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y + '년'; yearSel.appendChild(o); });
  yearSel.value = years.includes(defYear) ? defYear : years[0];
  container.appendChild(yearSel);

  // 월 셀렉터
  const monthSel = document.createElement('select');
  monthSel.id = 'dow-month';
  const populateMonths = () => {
    monthSel.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const key = `${yearSel.value}-${String(m).padStart(2,'0')}`;
      if (yms.includes(key)) { const o = document.createElement('option'); o.value = m; o.textContent = m + '월'; monthSel.appendChild(o); }
    }
  };
  populateMonths();
  if (prevMonth && [...monthSel.options].some(o => o.value === prevMonth)) {
    monthSel.value = prevMonth;
  } else {
    // 기본: 해당 년도의 최신 월
    const lastOpt = monthSel.options[monthSel.options.length - 1];
    if (lastOpt) monthSel.value = lastOpt.value;
  }
  container.appendChild(monthSel);

  // 주별: 주차 셀렉터 추가
  const addWeekSelector = () => {
    const oldWeek = document.getElementById('dow-week');
    if (oldWeek) oldWeek.remove();
    if (mode !== 'week') return;
    const weeks = getWeeksInMonth(parseInt(yearSel.value), parseInt(monthSel.value) - 1);
    const weekSel = document.createElement('select');
    weekSel.id = 'dow-week';
    weeks.forEach((w, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${i+1}주 (${w.label})`; weekSel.appendChild(o); });
    weekSel.value = String(weeks.length - 1);
    container.appendChild(weekSel);
    weekSel.addEventListener('change', () => renderDowChartData());
  };
  addWeekSelector();

  // 이벤트
  yearSel.addEventListener('change', () => {
    populateMonths();
    addWeekSelector();
    renderDowChartData();
  });
  monthSel.addEventListener('change', () => {
    addWeekSelector();
    renderDowChartData();
  });
}

// 실제 차트 데이터 렌더링
function renderDowChartData() {
  const posts = filterByMilestone(DATA.posts);
  const mode = dowCurrentMode;
  if (dowChartInstance) dowChartInstance.destroy();

  const yearEl = document.getElementById('dow-year');
  const monthEl = document.getElementById('dow-month');
  const selYear = yearEl ? parseInt(yearEl.value) : null;
  const selMonth = monthEl ? parseInt(monthEl.value) - 1 : null; // 0-indexed

  // ── 일별 모드: 해당 월 전체 날짜별 ──
  if (mode === 'daily') {
    const monthPosts = posts.filter(p => {
      const d = parseUploadDate(p.upload_date);
      return d && d.getFullYear() === selYear && d.getMonth() === selMonth;
    });
    const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
    const allDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dt = new Date(selYear, selMonth, i);
      const dayChar = ['일','월','화','수','목','금','토'][dt.getDay()];
      allDays.push({ date: dt, label: `${String(i).padStart(2,'0')}(${dayChar})`, reach: [], eng: [] });
    }
    monthPosts.forEach(p => {
      const d = parseUploadDate(p.upload_date);
      if (d) { const idx = d.getDate() - 1; if (allDays[idx]) { if (p.reach) allDays[idx].reach.push(p.reach); if (p.engagement_rate) allDays[idx].eng.push(p.engagement_rate); } }
    });
    const today = new Date();
    const entries = allDays.filter(d => d.date <= today);
    const titleLabel = `${selYear}년 ${selMonth+1}월`;

    dowChartInstance = new ApexCharts(document.getElementById('chart-daily-reach'), {
      ...chartTheme,
      series: [
        { name: '총 도달', type: 'bar', data: entries.map(e => sum(e.reach)) },
        { name: '평균 참여율', type: 'line', data: entries.map(e => e.eng.length ? +avg(e.eng).toFixed(1) : 0) },
      ],
      chart: { ...chartTheme.chart, type: 'line', height: 300 },
      xaxis: { categories: entries.map(e => e.label), labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: true } },
      yaxis: [
        { title: { text: '총 도달', style: { color: '#9499b3' } }, labels: { formatter: v => fmt(v) } },
        { opposite: true, title: { text: '참여율(%)', style: { color: '#9499b3' } }, labels: { formatter: v => v.toFixed(1) + '%' }, min: 0 },
      ],
      colors: [chartColors.blue, chartColors.green],
      plotOptions: { bar: { borderRadius: 2, columnWidth: '70%' } },
      stroke: { width: [0, 2] }, markers: { size: [0, 3] }, grid: chartTheme.grid,
      tooltip: { ...chartTheme.tooltip, shared: true, custom: ({ dataPointIndex }) => {
        const e = entries[dataPointIndex]; const cnt = e.reach.length;
        return `<div style="padding:10px;font-size:12px"><strong>${titleLabel} ${e.label}</strong>${cnt ? ` (${cnt}개)` : ' (없음)'}<br>총 도달: <b>${fmt(sum(e.reach))}</b><br>참여율: <b>${e.eng.length ? avg(e.eng).toFixed(1) : 0}%</b></div>`;
      }},
    });
    dowChartInstance.render();
    return;
  }

  // ── 요일별 평균 모드 (전체 / 월별 / 주별) ──
  const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
  let filtered = posts;
  let modeLabel = '전체';

  if (mode === 'month') {
    filtered = posts.filter(p => { const d = parseUploadDate(p.upload_date); return d && d.getFullYear() === selYear && d.getMonth() === selMonth; });
    modeLabel = `${selYear}년 ${selMonth+1}월`;
  } else if (mode === 'week') {
    const weeks = getWeeksInMonth(selYear, selMonth);
    const weekEl = document.getElementById('dow-week');
    const wi = weekEl ? parseInt(weekEl.value) : weeks.length - 1;
    const week = weeks[wi];
    if (week) {
      filtered = posts.filter(p => {
        const d = parseUploadDate(p.upload_date);
        return d && d >= week.start && d <= week.endDate;
      });
      modeLabel = `${selYear}년 ${selMonth+1}월 ${wi+1}주차 (${week.label})`;
    }
  }

  const dayMap = {};
  dayOrder.forEach(d => { dayMap[d] = { reach: [], eng: [], count: 0, posts: [] }; });
  filtered.forEach(p => {
    const m = p.upload_date.match(/\((.)\)/);
    if (m && dayMap[m[1]]) {
      dayMap[m[1]].count++;
      dayMap[m[1]].posts.push(p);
      if (p.reach) dayMap[m[1]].reach.push(p.reach);
      if (p.engagement_rate) dayMap[m[1]].eng.push(p.engagement_rate);
    }
  });
  const stats = dayOrder.map(d => ({ day: d, count: dayMap[d].count, avgReach: avg(dayMap[d].reach), avgEng: avg(dayMap[d].eng), posts: dayMap[d].posts }));

  dowChartInstance = new ApexCharts(document.getElementById('chart-daily-reach'), {
    ...chartTheme,
    series: [
      { name: '평균 도달', type: 'bar', data: stats.map(s => Math.round(s.avgReach)) },
      { name: '평균 참여율', type: 'line', data: stats.map(s => +s.avgEng.toFixed(1)) },
    ],
    chart: {
      ...chartTheme.chart,
      type: 'line',
      height: 300,
      events: {
        dataPointSelection: function(event, chartContext, config) {
          const dayIndex = config.dataPointIndex;
          const dayStats = stats[dayIndex];
          if (dayStats && dayStats.posts.length > 0) {
            showDayPostsModal(dayStats, modeLabel);
          }
        }
      }
    },
    xaxis: { categories: stats.map(s => s.day + '요일'), labels: { style: { fontSize: '12px' } } },
    yaxis: [
      { title: { text: '평균 도달', style: { color: '#9499b3' } }, labels: { formatter: v => fmt(v) } },
      { opposite: true, title: { text: '참여율(%)', style: { color: '#9499b3' } }, labels: { formatter: v => v.toFixed(1) + '%' }, min: 0 },
    ],
    colors: [chartColors.blue, chartColors.green],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
    stroke: { width: [0, 3] }, markers: { size: [0, 5] }, grid: chartTheme.grid,
    tooltip: { ...chartTheme.tooltip, shared: true, custom: ({ dataPointIndex }) => {
      const s = stats[dataPointIndex];
      return `<div style="padding:10px;font-size:12px"><strong>${s.day}요일</strong> [${modeLabel}] (${s.count}개)<br>평균 도달: <b>${fmt(Math.round(s.avgReach))}</b><br>참여율: <b>${s.avgEng.toFixed(1)}%</b><br><span style="color:#666;font-size:10px">클릭하여 상세 보기</span></div>`;
    }},
    annotations: { xaxis: [{
      x: stats.reduce((best, s) => s.avgReach > best.avgReach && s.count > 0 ? s : best, stats[0]).day + '요일',
      borderColor: chartColors.accent3,
      label: { text: '최적 업로드 요일', style: { background: chartColors.accent3, color: '#fff', fontSize: '11px', padding: { left: 6, right: 6, top: 2, bottom: 2 } } },
    }]},
  });
  dowChartInstance.render();
}

// 요일별 콘텐츠 상세 모달
function showDayPostsModal(dayStats, modeLabel) {
  const { day, posts, avgReach, avgEng } = dayStats;

  // 날짜 포맷 (YY.MM.DD.요일 형식) - 모달용
  function formatDateWithDayLocal(dateStr) {
    if (!dateStr) return '날짜미상';
    const dayMatch = dateStr.match(/\((.)\)/);
    const dayOfWeek = dayMatch ? dayMatch[1] : '';
    let d;
    if (dateStr.includes('-')) {
      d = new Date(dateStr.split(' ')[0]);
    } else {
      const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{2})/);
      if (parts) {
        d = new Date(2000 + parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
      }
    }
    if (!d || isNaN(d)) return '날짜미상';
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}.${dayOfWeek}`;
  }

  // 제목 추출 (title 필드 우선, 없으면 caption에서)
  function getPostTitleLocal(post) {
    if (post.title && post.title.trim()) {
      const title = post.title.trim();
      if (title.length > 25) {
        return title.slice(0, 25) + '...';
      }
      return title;
    }
    if (post.caption && post.caption.trim()) {
      const caption = post.caption.trim();
      const firstLine = caption.split('\n')[0].trim();
      if (firstLine.length > 25) {
        return firstLine.slice(0, 25) + '...';
      }
      return firstLine;
    }
    return '';
  }

  // 도달 순으로 정렬
  const sortedPosts = [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0));

  // 모달 HTML 생성
  const postsHtml = sortedPosts.map((p, i) => {
    const date = formatDateWithDayLocal(p.upload_date);
    const title = getPostTitleLocal(p);
    const label = title ? `${date} / ${title}` : date;
    const link = p.url || p.permalink || (p.id ? `https://www.instagram.com/p/${p.id}/` : null);
    const linkHtml = link
      ? `<a href="${link}" target="_blank" style="color:var(--fj-primary);text-decoration:underline;">${label}</a>`
      : label;

    return `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 6px;text-align:center;color:#666;">${i + 1}</td>
        <td style="padding:8px 6px;">${linkHtml}</td>
        <td style="padding:8px 6px;text-align:right;font-weight:600;">${fmt(p.reach || 0)}</td>
        <td style="padding:8px 6px;text-align:right;font-weight:600;">${(p.engagement_rate || 0).toFixed(1)}%</td>
        <td style="padding:8px 6px;text-align:right;">${fmt(p.likes || 0)}</td>
        <td style="padding:8px 6px;text-align:right;">${fmt(p.saved || 0)}</td>
      </tr>
    `;
  }).join('');

  const modalHtml = `
    <div class="modal-overlay" id="day-posts-modal" style="z-index:2000;">
      <div class="modal-content" style="max-width:700px;max-height:80vh;overflow-y:auto;">
        <button class="modal-close" onclick="document.getElementById('day-posts-modal').remove()">×</button>
        <h2 class="modal-title" style="margin-bottom:16px;">
          📅 ${day}요일 콘텐츠 상세 <span style="font-size:14px;color:#666;font-weight:400;">[${modeLabel}]</span>
        </h2>
        <div style="display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap;">
          <div style="background:#f0f4ff;padding:12px 16px;border-radius:10px;text-align:center;">
            <div style="font-size:11px;color:#666;margin-bottom:4px;">총 게시물</div>
            <div style="font-size:20px;font-weight:700;color:var(--fj-primary);">${posts.length}개</div>
          </div>
          <div style="background:#f0f4ff;padding:12px 16px;border-radius:10px;text-align:center;">
            <div style="font-size:11px;color:#666;margin-bottom:4px;">평균 도달</div>
            <div style="font-size:20px;font-weight:700;color:var(--fj-primary);">${fmt(Math.round(avgReach))}</div>
          </div>
          <div style="background:#e8fff0;padding:12px 16px;border-radius:10px;text-align:center;">
            <div style="font-size:11px;color:#666;margin-bottom:4px;">평균 참여율</div>
            <div style="font-size:20px;font-weight:700;color:#10b981;">${avgEng.toFixed(1)}%</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:var(--fj-primary);color:#fff;">
              <th style="padding:10px 6px;text-align:center;width:40px;">#</th>
              <th style="padding:10px 6px;text-align:left;">콘텐츠</th>
              <th style="padding:10px 6px;text-align:right;">도달</th>
              <th style="padding:10px 6px;text-align:right;">참여율</th>
              <th style="padding:10px 6px;text-align:right;">좋아요</th>
              <th style="padding:10px 6px;text-align:right;">저장</th>
            </tr>
          </thead>
          <tbody>
            ${postsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // 기존 모달 제거 후 새로 추가
  document.getElementById('day-posts-modal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // 배경 클릭 시 닫기
  document.getElementById('day-posts-modal').addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.remove();
    }
  });
}

// 모드 전환 진입점
function renderDowChart(mode) {
  dowCurrentMode = mode;
  document.querySelectorAll('#dow-toggle .toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  updateDowSelectors(mode);
  renderDowChartData();
}

// 토글 이벤트 바인딩
document.getElementById('dow-toggle')?.addEventListener('click', e => {
  const btn = e.target.closest('.toggle-btn');
  if (btn && btn.dataset.mode) renderDowChart(btn.dataset.mode);
});

function renderPostTable() {
  const posts = filterByMilestone(DATA.posts);
  buildYesterdayMap();

  // Populate category filter
  const categories = [...new Set(posts.map(p => p.category).filter(Boolean))].sort();
  const catSelect = document.getElementById('filter-category');
  catSelect.innerHTML = '<option value="">전체 카테고리</option>';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    catSelect.appendChild(opt);
  });

  // Initial data with original rank
  const initialData = recalcRankedData(posts, 'rank', 'asc');

  document.getElementById('post-table').innerHTML = '';
  postTable = new Tabulator('#post-table', {
    data: initialData,
    layout: 'fitColumns',
    height: '600px',
    pagination: true,
    paginationSize: 50,
    paginationSizeSelector: [25, 50, 100, true],
    locale: true,
    langs: { "default": { "pagination": { "page_size": "표시 개수", "first": "≪", "prev": "‹", "next": "›", "last": "≫" } } },
    movableColumns: true,
    columnDefaults: { headerSortClickElement: 'icon' },
    columns: buildColumns('rank'),
  });

  // 칼럼 드래그 이동 시 순서 저장
  postTable.on('columnMoved', () => {
    saveColumnOrder();
  });

  // Tabulator 헤더 클릭 정렬 시 순위(_rank) 자동 동기화
  let _rankTimer = null;
  postTable.on('dataSorted', (sorters) => {
    if (!sorters.length) return;
    // 여러 번 연속 발생 시 마지막 것만 처리 (debounce)
    clearTimeout(_rankTimer);
    _rankTimer = setTimeout(() => {
      const activeRows = postTable.getRows("active");
      activeRows.forEach((row, i) => {
        row.getData()._rank = i + 1;
      });
      // 모든 행의 순위 셀 DOM 갱신
      postTable.getRows().forEach(row => {
        const cell = row.getCell('_rank');
        if (cell) cell.getElement().textContent = row.getData()._rank;
      });
    }, 50);
  });

  // Row click → diagnosis modal or manual input
  postTable.on('rowClick', (e, row) => {
    if (e.target.tagName === 'A') return;
    // 수동 입력 버튼 클릭
    if (e.target.classList.contains('manual-edit-btn')) {
      e.stopPropagation();
      const post = DATA.posts.find(p => p.url === e.target.dataset.url);
      if (post) openManualInputModal(post);
      return;
    }
    showPostModal(row.getData());
  });

  // Bind event listeners only once
  if (!renderPostTable._bound) {
    renderPostTable._bound = true;
    document.getElementById('sort-select').addEventListener('change', function() {
      const [field, dir] = this.value.split('|');
      currentSortField = field;
      const rankedData = recalcRankedData(filterByMilestone(DATA.posts), field, dir);
      // Tabulator 내부 소터 클리어 → replaceData 순서 유지
      postTable.clearSort();
      // 칼럼 순서 유지하면서 데이터만 교체
      if (userColumnOrder) {
        postTable.replaceData(rankedData);
      } else {
        postTable.setColumns(buildColumns(field));
        postTable.replaceData(rankedData);
      }
      applyFilters();
    });
    document.getElementById('filter-category').addEventListener('change', applyFilters);
    document.getElementById('filter-type').addEventListener('change', applyFilters);
    document.getElementById('filter-search').addEventListener('input', applyFilters);
  }
}

function applyFilters() {
  const cat = document.getElementById('filter-category').value;
  const type = document.getElementById('filter-type').value;
  const search = document.getElementById('filter-search').value.toLowerCase();

  const filters = [];
  if (cat) filters.push({ field: 'category', type: '=', value: cat });
  if (type) filters.push({ field: 'media_type', type: '=', value: type });
  postTable.setFilter(filters);
  // 제목 + 카테고리 + 유형 통합 검색 (커스텀 필터)
  if (search) {
    postTable.addFilter(function(data) {
      const s = search;
      return (data.title || '').toLowerCase().includes(s)
        || (data.category || '').toLowerCase().includes(s)
        || typeLabel(data.media_type || '').toLowerCase().includes(s);
    });
  }
}

// ══════════════════════════════════════════════════
// TAB 3: Followers
// ══════════════════════════════════════════════════

// 팔로워 월 선택 상태
let followerSelectedYear = null;
let followerSelectedMonth = null;

function parseFollowerDate(str) {
  // "26.01.30(금)" → { year: 2026, month: 1, day: 30, dateObj: Date }
  const m = str.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (!m) return null;
  const y = 2000 + parseInt(m[1]);
  const mo = parseInt(m[2]);
  const d = parseInt(m[3]);
  return { year: y, month: mo, day: d, dateObj: new Date(y, mo - 1, d) };
}

function getFollowerMonths(followers) {
  // 팔로워 데이터에서 사용 가능한 년/월 목록 추출
  const monthSet = new Map();
  followers.forEach(f => {
    const p = parseFollowerDate(f.date);
    if (!p) return;
    const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
    if (!monthSet.has(key)) monthSet.set(key, { year: p.year, month: p.month });
  });
  return Array.from(monthSet.values()).sort((a, b) => a.year - b.year || a.month - b.month);
}

function filterFollowersByMonth(followers, year, month) {
  if (!year || !month) return followers;
  return followers.filter(f => {
    const p = parseFollowerDate(f.date);
    return p && p.year === year && p.month === month;
  });
}

function fillMonthDays(filtered, year, month) {
  // 선택된 월의 1일~말일까지 31일치 틀을 만들고, 데이터가 있는 날만 채움
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dataMap = {};
  filtered.forEach(f => {
    const p = parseFollowerDate(f.date);
    if (p) dataMap[p.day] = f;
  });

  const result = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    const yy = String(year).slice(2);
    const mm = String(month).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dayLabel = `${yy}.${mm}.${dd}(${dayNames[dt.getDay()]})`;
    if (dataMap[d]) {
      result.push({ ...dataMap[d], date: dayLabel, _hasData: true });
    } else {
      result.push({ date: dayLabel, followers: null, following: null, daily_change: null, cumulative_change: null, _hasData: false });
    }
  }
  return result;
}

function setupFollowerMonthSelector(followers) {
  const yearSelect = document.getElementById('follower-year-select');
  const monthSelect = document.getElementById('follower-month-select');
  if (!yearSelect || !monthSelect) return;

  const months = getFollowerMonths(followers);
  if (!months.length) return;

  // 사용 가능한 년도 목록
  const years = [...new Set(months.map(m => m.year))].sort();

  // 현재 선택값이 없으면 가장 최근 월로 초기화
  if (!followerSelectedYear || !followerSelectedMonth) {
    const latest = months[months.length - 1];
    followerSelectedYear = latest.year;
    followerSelectedMonth = latest.month;
  }

  // 년도 드롭다운
  yearSelect.innerHTML = years.map(y =>
    `<option value="${y}" ${y === followerSelectedYear ? 'selected' : ''}>${y}년</option>`
  ).join('');

  // 선택된 년도의 월 목록
  const updateMonthOptions = () => {
    const availableMonths = months.filter(m => m.year === followerSelectedYear);
    monthSelect.innerHTML = availableMonths.map(m =>
      `<option value="${m.month}" ${m.month === followerSelectedMonth ? 'selected' : ''}>${m.month}월</option>`
    ).join('');
    // 선택된 월이 해당 년도에 없으면 마지막 월로
    if (!availableMonths.some(m => m.month === followerSelectedMonth)) {
      const last = availableMonths[availableMonths.length - 1];
      if (last) {
        followerSelectedMonth = last.month;
        monthSelect.value = last.month;
      }
    }
  };
  updateMonthOptions();

  // 이벤트 (기존 리스너 제거를 위해 복제 교체)
  const newYearSelect = yearSelect.cloneNode(true);
  yearSelect.parentNode.replaceChild(newYearSelect, yearSelect);
  const newMonthSelect = monthSelect.cloneNode(true);
  monthSelect.parentNode.replaceChild(newMonthSelect, monthSelect);

  newYearSelect.addEventListener('change', () => {
    followerSelectedYear = parseInt(newYearSelect.value);
    // 월 옵션 갱신
    const availableMonths = months.filter(m => m.year === followerSelectedYear);
    newMonthSelect.innerHTML = availableMonths.map(m =>
      `<option value="${m.month}">${m.month}월</option>`
    ).join('');
    const last = availableMonths[availableMonths.length - 1];
    if (last) {
      followerSelectedMonth = last.month;
      newMonthSelect.value = last.month;
    }
    renderFollowerCharts();
  });

  newMonthSelect.addEventListener('change', () => {
    followerSelectedMonth = parseInt(newMonthSelect.value);
    renderFollowerCharts();
  });
}

function renderFollowerCharts() {
  const allFollowers = filterFollowersByMilestone(DATA.followers);
  const filtered = filterFollowersByMonth(allFollowers, followerSelectedYear, followerSelectedMonth);
  const monthDays = fillMonthDays(filtered, followerSelectedYear, followerSelectedMonth);

  // 데이터가 있는 항목만 연결선용으로 추출
  const withData = monthDays.filter(d => d._hasData);

  // 데이터 부족 안내
  const followerNotice = document.getElementById('follower-data-notice');
  if (followerNotice) {
    if (withData.length === 0) {
      followerNotice.style.display = 'block';
      followerNotice.textContent = `${followerSelectedYear}년 ${followerSelectedMonth}월 데이터가 없습니다`;
    } else if (withData.length < 14) {
      followerNotice.style.display = 'block';
      followerNotice.textContent = `현재 ${withData.length}일치 데이터 수집 중 — 추세 분석은 14일 이상의 데이터에서 더 정확합니다`;
    } else {
      followerNotice.style.display = 'none';
    }
  }

  // X축: 일자 (1~31), Y축: 팔로워 수 (데이터 없으면 null)
  const labels = monthDays.map(d => {
    const m = d.date.match(/\d{2}\.\d{2}\.(\d{2})/);
    return m ? m[1] + '일' : d.date;
  });
  const values = monthDays.map(d => d._hasData ? d.followers : null);

  // Full follower chart (area)
  document.getElementById('chart-follower-full').innerHTML = '';
  trackChart(new ApexCharts(document.getElementById('chart-follower-full'), {
    ...chartTheme,
    series: [{ name: '팔로워', data: values }],
    chart: { ...chartTheme.chart, type: 'area', height: 300 },
    xaxis: { categories: labels, labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: monthDays.length > 15 } },
    yaxis: { labels: { formatter: v => v != null ? fmt(v) : '' } },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
    colors: [chartColors.accent2],
    grid: chartTheme.grid,
    tooltip: { ...chartTheme.tooltip, y: { formatter: v => v != null ? fmt(v) + '명' : '데이터 없음' } },
    markers: { size: withData.length <= 15 ? 4 : 0 },
  })).render();

  // Daily change bar chart
  const changes = [];
  for (let i = 0; i < monthDays.length; i++) {
    const cur = monthDays[i];
    if (!cur._hasData) { changes.push({ label: labels[i], change: null }); continue; }
    // 이전 데이터 포인트 찾기
    let prev = null;
    for (let j = i - 1; j >= 0; j--) {
      if (monthDays[j]._hasData) { prev = monthDays[j]; break; }
    }
    // 이전 달 마지막 데이터도 확인
    if (!prev) {
      const allBefore = allFollowers.filter(f => {
        const p = parseFollowerDate(f.date);
        return p && (p.year < followerSelectedYear || (p.year === followerSelectedYear && p.month < followerSelectedMonth));
      });
      if (allBefore.length) prev = allBefore[allBefore.length - 1];
    }
    const change = prev ? (cur.followers || 0) - (prev.followers || 0) : 0;
    changes.push({ label: labels[i], change });
  }

  document.getElementById('chart-follower-change').innerHTML = '';
  trackChart(new ApexCharts(document.getElementById('chart-follower-change'), {
    ...chartTheme,
    series: [{ name: '변화', data: changes.map(c => c.change) }],
    chart: { ...chartTheme.chart, type: 'bar', height: 250 },
    xaxis: { categories: changes.map(c => c.label), labels: { style: { fontSize: '10px' }, rotate: -45, rotateAlways: changes.length > 15 } },
    colors: [chartColors.green],
    plotOptions: {
      bar: {
        borderRadius: 3,
        colors: {
          ranges: [{ from: -1000, to: -1, color: chartColors.red }, { from: 0, to: 10000, color: chartColors.green }],
        },
      },
    },
    grid: chartTheme.grid,
    tooltip: { ...chartTheme.tooltip, y: { formatter: v => v != null ? (v >= 0 ? '+' : '') + fmt(v) + '명' : '데이터 없음' } },
  })).render();
}

function renderFollowers() {
  const allFollowers = filterFollowersByMilestone(DATA.followers);
  if (!allFollowers.length) {
    document.getElementById('kpi-total-growth').textContent = '-';
    document.getElementById('kpi-avg-growth').textContent = '-';
    document.getElementById('kpi-current-followers').textContent = '-';
    document.getElementById('kpi-best-day').textContent = '-';
    document.getElementById('chart-follower-full').innerHTML = '';
    document.getElementById('chart-follower-change').innerHTML = '';
    return;
  }

  const latest = allFollowers[allFollowers.length - 1];
  const first = allFollowers[0];

  // 총 성장: 팔로워 추적 첫 데이터 기준
  const totalGrowth = (latest.followers || 0) - (first.followers || 0);

  // 일평균 성장: 추적 기간 일수 기준
  const firstParsed = parseFollowerDate(first.date);
  const latestParsed = parseFollowerDate(latest.date);
  const trackingDays = (firstParsed && latestParsed) ? Math.max(1, Math.round((latestParsed.dateObj - firstParsed.dateObj) / 86400000)) : Math.max(1, allFollowers.length - 1);
  const avgGrowth = totalGrowth / trackingDays;

  document.getElementById('kpi-total-growth').textContent = (totalGrowth >= 0 ? '+' : '') + fmt(totalGrowth);
  document.getElementById('kpi-avg-growth').textContent = (avgGrowth >= 0 ? '+' : '') + avgGrowth.toFixed(1) + '/일';
  document.getElementById('kpi-current-followers').textContent = fmt(latest.followers);

  // 툴팁 설명 업데이트
  const tooltipGrowth = document.getElementById('tooltip-total-growth');
  if (tooltipGrowth) {
    tooltipGrowth.innerHTML = `<strong>계산식</strong><br>최신(${latest.date}) ${fmt(latest.followers)}명<br>- 시작(${first.date}) ${fmt(first.followers)}명<br>= <strong>${totalGrowth >= 0 ? '+' : ''}${fmt(totalGrowth)}명</strong>`;
  }

  const tooltipAvg = document.getElementById('tooltip-avg-growth');
  if (tooltipAvg) {
    tooltipAvg.innerHTML = `<strong>계산식</strong><br>총 성장 ${fmt(totalGrowth)}명 ÷ ${trackingDays}일<br>= <strong>${avgGrowth >= 0 ? '+' : ''}${avgGrowth.toFixed(1)}명/일</strong>`;
  }

  const tooltipCurrent = document.getElementById('tooltip-current-followers');
  if (tooltipCurrent) {
    tooltipCurrent.innerHTML = `<strong>${latest.date} 기준</strong><br>가장 최근 수집된 팔로워 수`;
  }

  // 최고 성장일 계산
  const changes = allFollowers.map((f, i) => {
    if (i === 0) return { date: f.date, change: 0, prev: 0, cur: f.followers };
    const prev = allFollowers[i - 1].followers || 0;
    const cur = f.followers || 0;
    return { date: f.date, change: cur - prev, prev, cur };
  });
  const best = changes.reduce((a, b) => (b.change > a.change ? b : a), changes[0]);
  document.getElementById('kpi-best-day').textContent = best.date + ' (+' + fmt(best.change) + ')';

  const tooltipBest = document.getElementById('tooltip-best-day');
  if (tooltipBest) {
    tooltipBest.innerHTML = `<strong>최고 성장일</strong><br>${best.date}: ${fmt(best.prev)}명 → ${fmt(best.cur)}명<br>하루에 <strong>+${fmt(best.change)}명</strong> 증가`;
  }

  // 년/월 선택기 설정
  setupFollowerMonthSelector(allFollowers);

  // 차트 렌더링
  renderFollowerCharts();
}

// ══════════════════════════════════════════════════
// TAB 4: Category Analysis
// ══════════════════════════════════════════════════
function renderCategory() {
  const posts = filterByMilestone(DATA.posts);
  const catMap = {};
  posts.forEach(p => {
    const c = p.category || '기타';
    if (!catMap[c]) catMap[c] = [];
    catMap[c].push(p);
  });

  const catStats = Object.entries(catMap).map(([cat, items]) => ({
    category: cat,
    count: items.length,
    avgEngagement: avg(items.map(p => p.engagement_rate).filter(v => v != null)),
    avgReach: avg(items.map(p => p.reach).filter(v => v != null)),
    avgSaves: avg(items.map(p => p.saves).filter(v => v != null)),
    avgShares: avg(items.map(p => p.shares).filter(v => v != null)),
    avgScore: avg(items.map(p => p.composite_score).filter(v => v != null)),
  })).sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Insights
  const best = catStats[0];
  const bestReach = [...catStats].sort((a, b) => b.avgReach - a.avgReach)[0];
  const bestSave = [...catStats].sort((a, b) => b.avgSaves - a.avgSaves)[0];
  document.getElementById('category-insights').innerHTML =
    `<div class="insight-item">` +
    `<strong>${best.category}</strong> 카테고리의 평균 참여율이 ${best.avgEngagement.toFixed(1)}%로 가장 높습니다.<br>` +
    `<strong>${bestReach.category}</strong> 카테고리의 평균 도달이 ${fmt(Math.round(bestReach.avgReach))}으로 가장 넓습니다.<br>` +
    `<strong>${bestSave.category}</strong> 카테고리의 평균 저장수가 ${fmt(Math.round(bestSave.avgSaves))}으로 가장 높습니다.` +
    `</div>`;

  // Engagement bar chart
  document.getElementById('chart-cat-engagement').innerHTML = '';
  trackChart(new ApexCharts(document.getElementById('chart-cat-engagement'), {
    ...chartTheme,
    series: [{ name: '평균 참여율', data: catStats.map(c => +c.avgEngagement.toFixed(1)) }],
    chart: { ...chartTheme.chart, type: 'bar', height: 300 },
    xaxis: { categories: catStats.map(c => c.category), labels: { style: { fontSize: '12px' } } },
    yaxis: { labels: { formatter: v => v + '%' } },
    colors: [chartColors.accent],
    plotOptions: { bar: { borderRadius: 4, horizontal: true } },
    grid: chartTheme.grid,
    tooltip: { ...chartTheme.tooltip, y: { formatter: v => v + '%' } },
  })).render();

  // Reach bar chart
  document.getElementById('chart-cat-reach').innerHTML = '';
  trackChart(new ApexCharts(document.getElementById('chart-cat-reach'), {
    ...chartTheme,
    series: [{ name: '평균 도달', data: catStats.map(c => Math.round(c.avgReach)) }],
    chart: { ...chartTheme.chart, type: 'bar', height: 300 },
    xaxis: { categories: catStats.map(c => c.category), labels: { style: { fontSize: '12px' } } },
    yaxis: { labels: { formatter: v => fmt(v) } },
    colors: [chartColors.blue],
    plotOptions: { bar: { borderRadius: 4, horizontal: true } },
    grid: chartTheme.grid,
    tooltip: { ...chartTheme.tooltip, y: { formatter: v => fmt(v) } },
  })).render();

  // Save/Share grouped bar
  document.getElementById('chart-cat-save-share').innerHTML = '';
  trackChart(new ApexCharts(document.getElementById('chart-cat-save-share'), {
    ...chartTheme,
    series: [
      { name: '평균 저장', data: catStats.map(c => Math.round(c.avgSaves)) },
      { name: '평균 공유', data: catStats.map(c => Math.round(c.avgShares)) },
    ],
    chart: { ...chartTheme.chart, type: 'bar', height: 300 },
    xaxis: { categories: catStats.map(c => c.category), labels: { style: { fontSize: '12px' } } },
    colors: [chartColors.green, chartColors.orange],
    plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
    grid: chartTheme.grid,
    tooltip: { ...chartTheme.tooltip, y: { formatter: v => fmt(v) } },
  })).render();

  // Category summary table
  document.getElementById('cat-summary-table').innerHTML = '';
  new Tabulator('#cat-summary-table', {
    data: catStats,
    layout: 'fitColumns',
    movableColumns: true,
    columnDefaults: { headerSortClickElement: 'icon' },
    columns: [
      { title: '카테고리', field: 'category', width: 100 },
      { title: '게시물 수', field: 'count', width: 80, hozAlign: 'right', sorter: 'number' },
      { title: '평균 참여율', field: 'avgEngagement', width: 100, hozAlign: 'right', sorter: 'number',
        formatter: cell => cell.getValue().toFixed(1) + '%' },
      { title: '평균 도달', field: 'avgReach', width: 100, hozAlign: 'right', sorter: 'number',
        formatter: cell => { const v = Math.round(cell.getValue()); return `<span title="${fmt(v)}">${fmtCell(v)}</span>`; } },
      { title: '평균 저장', field: 'avgSaves', width: 80, hozAlign: 'right', sorter: 'number',
        formatter: cell => { const v = Math.round(cell.getValue()); return `<span title="${fmt(v)}">${fmtCell(v)}</span>`; } },
      { title: '평균 공유', field: 'avgShares', width: 80, hozAlign: 'right', sorter: 'number',
        formatter: cell => { const v = Math.round(cell.getValue()); return `<span title="${fmt(v)}">${fmtCell(v)}</span>`; } },
      { title: '평균 종합점수', field: 'avgScore', width: 100, hozAlign: 'right', sorter: 'number',
        formatter: cell => cell.getValue().toFixed(1) },
    ],
  });
}

// ══════════════════════════════════════════════════
// Performance Summary Analysis
// ══════════════════════════════════════════════════
function analyzePerformance(posts) {
  if (!posts.length) return { strengths: [], weaknesses: [], stats: {} };

  const reaches = posts.map(p => p.reach).filter(v => v != null);
  const engRates = posts.map(p => p.engagement_rate).filter(v => v != null);
  const saveRates = posts.map(p => p.save_rate).filter(v => v != null);
  const shareRates = posts.map(p => p.share_rate).filter(v => v != null);
  const likes = posts.map(p => p.likes).filter(v => v != null);
  const saves = posts.map(p => p.saves).filter(v => v != null);
  const shares = posts.map(p => p.shares).filter(v => v != null);
  const comments = posts.map(p => p.comments).filter(v => v != null);
  const follows = posts.map(p => p.follows).filter(v => v != null);

  const stats = {
    count: posts.length,
    avgReach: Math.round(avg(reaches)),
    avgEngRate: +avg(engRates).toFixed(2),
    avgSaveRate: +avg(saveRates).toFixed(2),
    avgShareRate: +avg(shareRates).toFixed(2),
    totalReach: sum(reaches),
    totalLikes: sum(likes),
    totalSaves: sum(saves),
    totalShares: sum(shares),
    totalComments: sum(comments),
    totalFollows: sum(follows),
  };

  const strengths = [];
  const weaknesses = [];

  // Engagement rate analysis
  const engGrade = getGrade(statBenchmarks.engagement_rate, stats.avgEngRate);
  if (engGrade && (engGrade.cls === 'excellent' || engGrade.cls === 'good')) {
    strengths.push(`평균 참여율 <strong>${stats.avgEngRate}%</strong> (${engGrade.label}) — 여행 업종 평균(1.2%) ${stats.avgEngRate >= 1.2 ? '이상' : '수준'}의 반응`);
  } else if (engGrade && engGrade.cls === 'low') {
    weaknesses.push(`평균 참여율 <strong>${stats.avgEngRate}%</strong> (${engGrade.label}) — 도달 대비 반응이 부족. 질문형 캡션, CTA 추가 검토`);
  }

  // Save rate analysis
  const saveGrade = getGrade(statBenchmarks.save_rate, stats.avgSaveRate);
  if (saveGrade && (saveGrade.cls === 'excellent' || saveGrade.cls === 'good')) {
    strengths.push(`평균 저장율 <strong>${stats.avgSaveRate}%</strong> (${saveGrade.label}) — 콘텐츠 가치가 높아 사용자가 저장하는 비율 우수`);
  } else if (saveGrade && saveGrade.cls === 'low') {
    weaknesses.push(`평균 저장율 <strong>${stats.avgSaveRate}%</strong> (${saveGrade.label}) — 정보성/실용적 콘텐츠(여행 팁, 코스 추천 등) 비율 확대 필요`);
  }

  // Share rate analysis
  const shareGrade = getGrade(statBenchmarks.share_rate, stats.avgShareRate);
  if (shareGrade && (shareGrade.cls === 'excellent' || shareGrade.cls === 'good')) {
    strengths.push(`평균 공유율 <strong>${stats.avgShareRate}%</strong> (${shareGrade.label}) — 바이럴 잠재력 높음. 2025 IG 알고리즘이 공유를 최우선 반영`);
  } else if (shareGrade && shareGrade.cls === 'low') {
    weaknesses.push(`평균 공유율 <strong>${stats.avgShareRate}%</strong> (${shareGrade.label}) — 공유 유도 콘텐츠(밈, 감성 영상, "친구 태그" 등) 시도 필요`);
  }

  // Content type analysis
  const typeMap = {};
  posts.forEach(p => { const t = p.media_type || 'OTHER'; if (!typeMap[t]) typeMap[t] = []; typeMap[t].push(p); });
  const typeEntries = Object.entries(typeMap);
  if (typeEntries.length >= 2) {
    const typeAvgs = typeEntries.map(([type, items]) => ({
      type, label: typeLabel(type),
      avgReach: avg(items.map(p => p.reach).filter(v => v != null)),
      avgSaveRate: avg(items.map(p => p.save_rate).filter(v => v != null)),
      count: items.length,
    }));
    const bestReachType = [...typeAvgs].sort((a, b) => b.avgReach - a.avgReach)[0];
    const bestSaveType = [...typeAvgs].sort((a, b) => b.avgSaveRate - a.avgSaveRate)[0];
    if (bestReachType) strengths.push(`<strong>${bestReachType.label}</strong>의 평균 도달(${fmt(Math.round(bestReachType.avgReach))})이 가장 높음 — 도달 확대에 효과적`);
    if (bestSaveType && bestSaveType.type !== bestReachType.type) {
      strengths.push(`<strong>${bestSaveType.label}</strong>의 저장율(${bestSaveType.avgSaveRate.toFixed(1)}%)이 가장 높음 — 콘텐츠 가치 전달에 효과적`);
    }
  }

  // Category analysis
  const catMap = {};
  posts.forEach(p => { const c = p.category || '미분류'; if (!catMap[c]) catMap[c] = []; catMap[c].push(p); });
  const catEntries = Object.entries(catMap).filter(([, items]) => items.length >= 3);
  if (catEntries.length >= 2) {
    const catAvgs = catEntries.map(([cat, items]) => ({
      cat, avgEng: avg(items.map(p => p.engagement_rate).filter(v => v != null)), count: items.length,
    }));
    const bestCat = [...catAvgs].sort((a, b) => b.avgEng - a.avgEng)[0];
    const worstCat = [...catAvgs].sort((a, b) => a.avgEng - b.avgEng)[0];
    if (bestCat) strengths.push(`카테고리 <strong>${bestCat.cat}</strong>의 참여율(${bestCat.avgEng.toFixed(1)}%)이 가장 높음 — 이 주제의 콘텐츠 확대 권장`);
    if (worstCat && worstCat.cat !== bestCat.cat && worstCat.avgEng < stats.avgEngRate * 0.7) {
      weaknesses.push(`카테고리 <strong>${worstCat.cat}</strong>의 참여율(${worstCat.avgEng.toFixed(1)}%)이 가장 낮음 — 주제 전환 또는 형식 변경 검토`);
    }
  }

  // Follow conversion
  if (stats.totalFollows > 0 && stats.totalReach > 0) {
    const followRate = (stats.totalFollows / stats.totalReach * 100);
    if (followRate > 0.1) {
      strengths.push(`팔로우 전환율 <strong>${followRate.toFixed(2)}%</strong> — 콘텐츠가 팔로우로 이어지는 비율이 양호`);
    }
  }

  // Check if posting is consistent
  if (posts.length < 10) {
    weaknesses.push(`분석 기간 내 게시물이 <strong>${posts.length}개</strong>로 적음 — 일관된 포스팅 빈도 유지 필요`);
  }

  // ── 실제 콘텐츠 기반 분석 (카테고리별 분류) ──
  // 게시물 링크 생성 (url > permalink > id 순으로 확인)
  function getPostLink(post) {
    if (post.url) return post.url;
    if (post.permalink) return post.permalink;
    if (post.id) return `https://www.instagram.com/p/${post.id}/`;
    return null;
  }

  // 날짜 포맷 (YY.MM.DD.요일 형식)
  function formatDateWithDay(dateStr) {
    if (!dateStr) return '날짜미상';
    // upload_date 형식: "2025-02-05 00:00:00 (수)" 또는 "25.02.05 (수)"
    const dayMatch = dateStr.match(/\((.)\)/);
    const dayOfWeek = dayMatch ? dayMatch[1] : '';

    let d;
    if (dateStr.includes('-')) {
      d = new Date(dateStr.split(' ')[0]);
    } else {
      const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{2})/);
      if (parts) {
        d = new Date(2000 + parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
      }
    }
    if (!d || isNaN(d)) return '날짜미상';

    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}.${dayOfWeek}`;
  }

  // 제목 추출 (title 필드 우선, 없으면 caption에서)
  function getPostTitle(post) {
    // title 필드가 있으면 사용
    if (post.title && post.title.trim()) {
      const title = post.title.trim();
      if (title.length > 25) {
        return title.slice(0, 25) + '...';
      }
      return title;
    }
    // caption 필드 fallback
    if (post.caption && post.caption.trim()) {
      const caption = post.caption.trim();
      const firstLine = caption.split('\n')[0].trim();
      if (firstLine.length > 25) {
        return firstLine.slice(0, 25) + '...';
      }
      return firstLine;
    }
    return '';
  }

  // 게시물 식별 + 링크 HTML 생성 (날짜 / 제목 형식)
  function getPostIdentifierWithLink(post) {
    const date = formatDateWithDay(post.upload_date);
    const title = getPostTitle(post);
    const label = title ? `${date} / ${title}` : date;
    const link = getPostLink(post);

    if (link) {
      return `<a href="${link}" target="_blank" style="color:var(--fj-primary);text-decoration:underline;">${label}</a>`;
    }
    return label;
  }

  // 카테고리별 분류
  const contentStrengths = [];  // 콘텐츠 기반 강점
  const contentWeaknesses = []; // 콘텐츠 기반 개선점

  if (posts.length >= 3) {
    // ── TOP 콘텐츠 분석 ──
    // 참여율 Top 게시물
    const sortedByEng = [...posts].filter(p => p.engagement_rate != null).sort((a, b) => b.engagement_rate - a.engagement_rate);
    if (sortedByEng.length > 0) {
      const top = sortedByEng[0];
      contentStrengths.push(`🏆 참여율 1위: ${getPostIdentifierWithLink(top)} — <strong>${top.engagement_rate.toFixed(1)}%</strong>`);
    }

    // 저장율 Top 게시물
    const sortedBySave = [...posts].filter(p => p.save_rate != null).sort((a, b) => b.save_rate - a.save_rate);
    if (sortedBySave.length > 0) {
      const top = sortedBySave[0];
      if (!sortedByEng.length || top.id !== sortedByEng[0].id) {
        contentStrengths.push(`💾 저장율 1위: ${getPostIdentifierWithLink(top)} — <strong>${top.save_rate.toFixed(1)}%</strong> (정보 가치 높음)`);
      }
    }

    // 공유율 Top 게시물
    const sortedByShare = [...posts].filter(p => p.share_rate != null && p.share_rate > 0.3).sort((a, b) => b.share_rate - a.share_rate);
    if (sortedByShare.length > 0) {
      const top = sortedByShare[0];
      contentStrengths.push(`📤 공유율 1위: ${getPostIdentifierWithLink(top)} — <strong>${top.share_rate.toFixed(1)}%</strong> (바이럴)`);
    }

    // 도달 Top 게시물
    const sortedByReach = [...posts].filter(p => p.reach != null).sort((a, b) => b.reach - a.reach);
    if (sortedByReach.length > 0) {
      const top = sortedByReach[0];
      contentStrengths.push(`👀 도달 1위: ${getPostIdentifierWithLink(top)} — <strong>${fmt(top.reach)}명</strong>`);
    }

    // ── 개선 필요 콘텐츠 분석 ──
    // 참여율 낮은 게시물
    const lowEngPosts = posts.filter(p => p.engagement_rate != null && p.engagement_rate < stats.avgEngRate * 0.5);
    if (lowEngPosts.length > 0) {
      const worst = lowEngPosts.sort((a, b) => a.engagement_rate - b.engagement_rate)[0];
      contentWeaknesses.push(`📉 참여율 저조: ${getPostIdentifierWithLink(worst)} — ${worst.engagement_rate.toFixed(1)}% (캡션/CTA 점검)`);
    }

    // 도달 대비 저장이 낮은 게시물
    const lowSavePosts = posts.filter(p => p.save_rate != null && p.save_rate < 0.5 && p.reach > stats.avgReach);
    if (lowSavePosts.length > 0) {
      const worst = lowSavePosts.sort((a, b) => a.save_rate - b.save_rate)[0];
      contentWeaknesses.push(`💾 저장율 저조: ${getPostIdentifierWithLink(worst)} — ${worst.save_rate.toFixed(1)}% (정보 가치 부족)`);
    }

    // 릴스 중 성과 낮은 콘텐츠
    const reels = posts.filter(p => p.media_type === 'VIDEO');
    if (reels.length >= 3) {
      const avgReelEng = avg(reels.map(p => p.engagement_rate).filter(v => v != null));
      const lowReels = reels.filter(p => p.engagement_rate != null && p.engagement_rate < avgReelEng * 0.5);
      if (lowReels.length > 0) {
        const worst = lowReels.sort((a, b) => a.engagement_rate - b.engagement_rate)[0];
        contentWeaknesses.push(`🎬 릴스 개선: ${getPostIdentifierWithLink(worst)} — 초반 훅/음악 점검`);
      }
    }

    // 캐러셀 중 성과 낮은 콘텐츠
    const carousels = posts.filter(p => p.media_type === 'CAROUSEL_ALBUM');
    if (carousels.length >= 3) {
      const avgCarEng = avg(carousels.map(p => p.engagement_rate).filter(v => v != null));
      const lowCars = carousels.filter(p => p.engagement_rate != null && p.engagement_rate < avgCarEng * 0.5);
      if (lowCars.length > 0) {
        const worst = lowCars.sort((a, b) => a.engagement_rate - b.engagement_rate)[0];
        contentWeaknesses.push(`📸 캐러셀 개선: ${getPostIdentifierWithLink(worst)} — 첫 장 구성 점검`);
      }
    }
  }

  return { strengths, weaknesses, contentStrengths, contentWeaknesses, stats };
}

function renderSummary(period, year, month, weekStart, weekEnd, dateStr) {
  const allPosts = filterByMilestone(DATA.posts);
  let posts = allPosts;
  let periodLabel = '전체';

  if (period === 'yearly' && year) {
    posts = allPosts.filter(p => { const d = parseUploadDate(p.upload_date); return d && d.getFullYear() === year; });
    periodLabel = `${year}년`;
  } else if (period === 'monthly' && year && month != null) {
    posts = allPosts.filter(p => { const d = parseUploadDate(p.upload_date); return d && d.getFullYear() === year && d.getMonth() === month; });
    periodLabel = `${year}년 ${month + 1}월`;
  } else if (period === 'weekly' && weekStart && weekEnd) {
    posts = allPosts.filter(p => { const d = parseUploadDate(p.upload_date); return d && d >= weekStart && d <= weekEnd; });
    periodLabel = `${weekStart.getFullYear()}년 ${weekStart.getMonth()+1}월 ${weekStart.getDate()}일~${weekEnd.getDate()}일`;
  } else if (period === 'daily' && dateStr) {
    posts = allPosts.filter(p => { const d = parseUploadDate(p.upload_date); return d && d.toISOString().slice(0, 10) === dateStr; });
    const dd = new Date(dateStr);
    periodLabel = `${dd.getFullYear()}년 ${dd.getMonth()+1}월 ${dd.getDate()}일`;
  }

  const { strengths, weaknesses, contentStrengths, contentWeaknesses, stats } = analyzePerformance(posts);
  const container = document.getElementById('summary-content');
  if (!posts.length) { container.innerHTML = '<p style="color:var(--text2)">해당 기간의 데이터가 없습니다.</p>'; return; }

  // 툴팁 + 벤치마크 바 생성 헬퍼
  function summaryTooltip(label, tooltip, benchmark, value) {
    const scaleHtml = benchmarkScaleHtml(benchmark, value);
    return `<div class="summary-stat-label">${label} <span class="kpi-tooltip-wrap"><span class="kpi-tooltip-icon">ⓘ</span><span class="kpi-tooltip-text">${tooltip}${scaleHtml}</span></span></div>`;
  }

  let html = '';
  // Overview stats
  html += `<div class="summary-overview">`;
  html += `<div class="summary-stat"><div class="summary-stat-label">기간</div><div class="summary-stat-value">${periodLabel}</div></div>`;
  html += `<div class="summary-stat"><div class="summary-stat-label">게시물</div><div class="summary-stat-value">${stats.count}</div></div>`;
  html += `<div class="summary-stat"><div class="summary-stat-label">평균 도달</div><div class="summary-stat-value">${fmt(stats.avgReach)}</div></div>`;
  html += `<div class="summary-stat">${summaryTooltip('참여율', '(좋아요+댓글+저장+공유) / 도달 × 100<br>콘텐츠에 반응한 비율', statBenchmarks.engagement_rate, stats.avgEngRate)}<div class="summary-stat-value">${fmtPct(stats.avgEngRate)}${gradeBadgeHtml(getGrade(statBenchmarks.engagement_rate, stats.avgEngRate))}</div></div>`;
  html += `<div class="summary-stat">${summaryTooltip('저장율', '저장 / 도달 × 100<br>콘텐츠를 저장할 만큼 가치를 느낀 비율', statBenchmarks.save_rate, stats.avgSaveRate)}<div class="summary-stat-value">${fmtPct(stats.avgSaveRate)}${gradeBadgeHtml(getGrade(statBenchmarks.save_rate, stats.avgSaveRate))}</div></div>`;
  html += `<div class="summary-stat">${summaryTooltip('공유율', '공유 / 도달 × 100<br>DM·스토리로 공유한 비율 (바이럴 지표)', statBenchmarks.share_rate, stats.avgShareRate)}<div class="summary-stat-value">${fmtPct(stats.avgShareRate)}${gradeBadgeHtml(getGrade(statBenchmarks.share_rate, stats.avgShareRate))}</div></div>`;
  html += `</div>`;

  // ── 지표 기반 강점/개선점 ──
  html += `<h4 style="font-size:14px;font-weight:700;color:var(--text);margin:20px 0 12px;border-bottom:2px solid var(--fj-primary);padding-bottom:6px;">📊 지표 분석</h4>`;
  html += `<div class="summary-grid">`;
  html += `<div class="summary-card"><h4 class="positive">✓ 강점</h4>`;
  if (strengths.length) {
    html += `<ul class="summary-list">${strengths.map(s => `<li>${s}</li>`).join('')}</ul>`;
  } else {
    html += `<p style="color:var(--text2);font-size:13px">데이터 부족으로 분석 불가</p>`;
  }
  html += `</div>`;
  html += `<div class="summary-card"><h4 class="negative">✗ 개선점</h4>`;
  if (weaknesses.length) {
    html += `<ul class="summary-list">${weaknesses.map(w => `<li>${w}</li>`).join('')}</ul>`;
  } else {
    html += `<p style="color:var(--text2);font-size:13px">특별한 개선점 없음 — 현재 전략 유지 권장</p>`;
  }
  html += `</div>`;
  html += `</div>`;

  // ── 콘텐츠 기반 강점/개선점 ──
  if (contentStrengths.length || contentWeaknesses.length) {
    html += `<h4 style="font-size:14px;font-weight:700;color:var(--text);margin:24px 0 12px;border-bottom:2px solid var(--fj-primary);padding-bottom:6px;">📝 콘텐츠별 분석</h4>`;
    html += `<div class="summary-grid">`;

    // TOP 콘텐츠
    html += `<div class="summary-card"><h4 class="positive">🏅 TOP 콘텐츠</h4>`;
    if (contentStrengths.length) {
      html += `<ul class="summary-list">${contentStrengths.map(s => `<li>${s}</li>`).join('')}</ul>`;
    } else {
      html += `<p style="color:var(--text2);font-size:13px">분석 데이터 부족</p>`;
    }
    html += `</div>`;

    // 개선 필요 콘텐츠
    html += `<div class="summary-card"><h4 class="negative">⚠️ 개선 필요</h4>`;
    if (contentWeaknesses.length) {
      html += `<ul class="summary-list">${contentWeaknesses.map(w => `<li>${w}</li>`).join('')}</ul>`;
    } else {
      html += `<p style="color:var(--text2);font-size:13px">전반적으로 양호 — 현재 전략 유지</p>`;
    }
    html += `</div>`;
    html += `</div>`;
  }

  container.innerHTML = html;

  // 지표별 TOP 카드도 같은 기간 필터 적용
  renderMetricChampions(posts, periodLabel);

  // 콘텐츠 분석 탭 전체 업데이트 (인사이트, 차트, TOP 10 테이블)
  updateContentAnalysis(posts, periodLabel);
}

function initSummaryControls() {
  const select = document.getElementById('summary-period-select');
  const selectors = document.getElementById('summary-period-selectors');
  if (!select) return;

  function updateSelectors() {
    const mode = select.value;
    selectors.innerHTML = '';
    if (mode === 'all') { renderSummary('all'); return; }

    const yms = getAvailableYearMonths(); // returns ["2025-01", "2025-02", ...]
    const years = [...new Set(yms.map(ym => ym.split('-')[0]))].sort((a, b) => b - a);

    // 년도 셀렉터 (yearly, monthly, weekly 에서 사용)
    if (mode === 'yearly' || mode === 'monthly' || mode === 'weekly') {
      const yearSel = document.createElement('select');
      yearSel.className = 'kpi-mode-dropdown';
      years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y + '년'; yearSel.appendChild(o); });
      selectors.appendChild(yearSel);

      if (mode === 'yearly') {
        yearSel.addEventListener('change', () => { renderSummary('yearly', +yearSel.value); });
        renderSummary('yearly', +yearSel.value);

      } else if (mode === 'monthly') {
        const monthSel = document.createElement('select');
        monthSel.className = 'kpi-mode-dropdown';
        function fillMonths() {
          const y = yearSel.value;
          const months = yms.filter(ym => ym.split('-')[0] === y).map(ym => parseInt(ym.split('-')[1], 10)).sort((a, b) => b - a);
          monthSel.innerHTML = '';
          months.forEach(m => { const o = document.createElement('option'); o.value = m - 1; o.textContent = m + '월'; monthSel.appendChild(o); });
        }
        fillMonths();
        selectors.appendChild(monthSel);
        yearSel.addEventListener('change', () => { fillMonths(); renderSummary('monthly', +yearSel.value, +monthSel.value); });
        monthSel.addEventListener('change', () => { renderSummary('monthly', +yearSel.value, +monthSel.value); });
        renderSummary('monthly', +yearSel.value, +monthSel.value);

      } else if (mode === 'weekly') {
        const monthSel = document.createElement('select');
        monthSel.className = 'kpi-mode-dropdown';
        function fillMonthsW() {
          const y = yearSel.value;
          const months = yms.filter(ym => ym.split('-')[0] === y).map(ym => parseInt(ym.split('-')[1], 10)).sort((a, b) => b - a);
          monthSel.innerHTML = '';
          months.forEach(m => { const o = document.createElement('option'); o.value = m - 1; o.textContent = m + '월'; monthSel.appendChild(o); });
        }
        fillMonthsW();
        selectors.appendChild(monthSel);

        const weekSel = document.createElement('select');
        weekSel.className = 'kpi-mode-dropdown';
        function fillWeeks() {
          const y = +yearSel.value; const m = +monthSel.value;
          const weeks = getWeeksInMonth(y, m);
          weekSel.innerHTML = '';
          weeks.forEach(w => { const o = document.createElement('option'); o.value = JSON.stringify({ start: w.start.toISOString(), end: w.endDate.toISOString() }); o.textContent = w.label; weekSel.appendChild(o); });
        }
        fillWeeks();
        selectors.appendChild(weekSel);

        yearSel.addEventListener('change', () => { fillMonthsW(); fillWeeks(); triggerWeekly(); });
        monthSel.addEventListener('change', () => { fillWeeks(); triggerWeekly(); });
        weekSel.addEventListener('change', () => { triggerWeekly(); });
        function triggerWeekly() {
          if (!weekSel.value) return;
          const w = JSON.parse(weekSel.value);
          renderSummary('weekly', null, null, new Date(w.start), new Date(w.end));
        }
        triggerWeekly();
      }

    } else if (mode === 'daily') {
      // 날짜 선택기
      const dateSel = document.createElement('input');
      dateSel.type = 'date';
      dateSel.className = 'kpi-mode-dropdown';
      // 기본값: 가장 최근 포스트 날짜
      const allPosts = filterByMilestone(DATA.posts);
      let latestDate = new Date();
      allPosts.forEach(p => { const d = parseUploadDate(p.upload_date); if (d && d > latestDate) latestDate = d; });
      // 가장 최근 데이터가 있는 날짜 찾기
      const postDates = new Set();
      allPosts.forEach(p => { const d = parseUploadDate(p.upload_date); if (d) postDates.add(d.toISOString().slice(0, 10)); });
      const sortedDates = [...postDates].sort().reverse();
      if (sortedDates.length) dateSel.value = sortedDates[0];
      selectors.appendChild(dateSel);

      dateSel.addEventListener('change', () => { renderSummary('daily', null, null, null, null, dateSel.value); });
      if (dateSel.value) renderSummary('daily', null, null, null, null, dateSel.value);
    }
  }

  select.addEventListener('change', updateSelectors);
  updateSelectors();
}

// ── Excel Report Export ──
function exportReport() {
  if (typeof XLSX === 'undefined') { alert('엑셀 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return; }

  const posts = filterByMilestone(DATA.posts);
  const wb = XLSX.utils.book_new();

  // Sheet 1: 전체 요약
  const overall = analyzePerformance(posts);
  const summaryRows = [
    ['IG 인사이트 성과 보고서'],
    ['생성일', new Date().toLocaleDateString('ko-KR')],
    ['기간', milestoneFilter === 'all' ? '전체' : milestoneFilter === 'after' ? '담당 이후 (2025.12.26~)' : '담당 이전 (~2025.12.25)'],
    [],
    ['■ 전체 요약'],
    ['게시물 수', overall.stats.count],
    ['평균 도달', overall.stats.avgReach],
    ['평균 참여율', overall.stats.avgEngRate + '%'],
    ['평균 저장율', overall.stats.avgSaveRate + '%'],
    ['평균 공유율', overall.stats.avgShareRate + '%'],
    ['총 도달', overall.stats.totalReach],
    ['총 좋아요', overall.stats.totalLikes],
    ['총 저장', overall.stats.totalSaves],
    ['총 공유', overall.stats.totalShares],
    ['총 댓글', overall.stats.totalComments],
    ['총 팔로우 유입', overall.stats.totalFollows],
    [],
    ['■ 강점'],
    ...overall.strengths.map(s => [s.replace(/<[^>]*>/g, '')]),
    [],
    ['■ 개선점'],
    ...overall.weaknesses.map(w => [w.replace(/<[^>]*>/g, '')]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, '전체 요약');

  // Sheet 2: 월별 추이
  const yms = getAvailableYearMonths(); // ["2025-01", ...]
  const monthlyData = [['년월', '게시물', '평균 도달', '참여율(%)', '저장율(%)', '공유율(%)', '총 도달', '총 좋아요', '총 저장', '총 공유', '총 댓글', '강점', '개선점']];
  yms.sort().forEach(ymStr => {
    const [yStr, mStr] = ymStr.split('-');
    const yr = parseInt(yStr, 10); const mo = parseInt(mStr, 10) - 1;
    const mPosts = posts.filter(p => { const d = parseUploadDate(p.upload_date); return d && d.getFullYear() === yr && d.getMonth() === mo; });
    if (!mPosts.length) return;
    const a = analyzePerformance(mPosts);
    monthlyData.push([
      `${yStr}.${mStr}`,
      a.stats.count, a.stats.avgReach, a.stats.avgEngRate, a.stats.avgSaveRate, a.stats.avgShareRate,
      a.stats.totalReach, a.stats.totalLikes, a.stats.totalSaves, a.stats.totalShares, a.stats.totalComments,
      a.strengths.map(s => s.replace(/<[^>]*>/g, '')).join(' / '),
      a.weaknesses.map(w => w.replace(/<[^>]*>/g, '')).join(' / '),
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(monthlyData);
  ws2['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 50 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws2, '월별 추이');

  // Sheet 3: 게시물 상세
  const postData = posts.map(p => ({
    '순위': p.rank || '',
    '날짜': p.upload_date || '',
    '유형': typeLabel(p.media_type),
    '카테고리': p.category || '',
    '제목': p.title || '',
    '도달': p.reach || 0,
    '조회수': p.views || 0,
    '좋아요': p.likes || 0,
    '저장': p.saves || 0,
    '공유': p.shares || 0,
    '댓글': p.comments || 0,
    '참여율(%)': p.engagement_rate || 0,
    '저장율(%)': p.save_rate || 0,
    '공유율(%)': p.share_rate || 0,
    '팔로우': p.follows || 0,
    'URL': p.url || '',
  }));
  const ws3 = XLSX.utils.json_to_sheet(postData);
  ws3['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws3, '게시물 상세');

  // Sheet 4: 콘텐츠 유형별
  const typeMap = {};
  posts.forEach(p => { const t = p.media_type || 'OTHER'; if (!typeMap[t]) typeMap[t] = []; typeMap[t].push(p); });
  const typeData = [['유형', '게시물 수', '평균 도달', '평균 참여율(%)', '평균 저장율(%)', '평균 공유율(%)', '평균 좋아요', '평균 저장', '평균 공유']];
  Object.entries(typeMap).forEach(([type, items]) => {
    typeData.push([
      typeLabel(type), items.length,
      Math.round(avg(items.map(p => p.reach).filter(v => v != null))),
      +avg(items.map(p => p.engagement_rate).filter(v => v != null)).toFixed(2),
      +avg(items.map(p => p.save_rate).filter(v => v != null)).toFixed(2),
      +avg(items.map(p => p.share_rate).filter(v => v != null)).toFixed(2),
      Math.round(avg(items.map(p => p.likes).filter(v => v != null))),
      Math.round(avg(items.map(p => p.saves).filter(v => v != null))),
      Math.round(avg(items.map(p => p.shares).filter(v => v != null))),
    ]);
  });
  const ws4 = XLSX.utils.aoa_to_sheet(typeData);
  XLSX.utils.book_append_sheet(wb, ws4, '유형별 분석');

  // Download
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `IG_인사이트_보고서_${dateStr}.xlsx`);
}

// ══════════════════════════════════════════════════
// PDF 성과 분석 리포트
// ══════════════════════════════════════════════════

// 현재 필터 기준으로 바로 PDF 다운로드
async function downloadQuickReport() {
  const periodSelect = document.getElementById('summary-period-select');
  const mode = periodSelect?.value || 'all';

  let startDate, endDate, periodLabel;
  const today = new Date();

  if (mode === 'all') {
    // 전체 평균: 첫 게시물 ~ 오늘 (전체 데이터)
    // DATA.posts에서 가장 오래된 날짜 찾기
    const allDates = DATA.posts.map(p => parseUploadDate(p.upload_date)).filter(d => d);
    const oldestDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date('2023-01-01');
    startDate = oldestDate.toISOString().slice(0, 10);
    endDate = today.toISOString().slice(0, 10);
    periodLabel = '전체 평균';
  } else if (mode === 'yearly') {
    // 년도별: 선택된 년도 1.1 ~ 오늘(해당 년도면) 또는 12.31(과거 년도면)
    const yearSelect = document.querySelector('#summary-period-selectors select');
    const year = parseInt(yearSelect?.value || today.getFullYear(), 10);
    const currentYear = today.getFullYear();
    startDate = `${year}-01-01`;
    // 현재 년도면 오늘까지, 과거 년도면 12.31까지
    if (year === currentYear) {
      endDate = today.toISOString().slice(0, 10);
    } else {
      endDate = `${year}-12-31`;
    }
    periodLabel = `${year}년`;
  } else if (mode === 'monthly') {
    // 월별: 선택된 년-월 (현재 월이면 오늘까지)
    // 주의: monthSel.value는 0-indexed (0=1월, 1=2월, ...)
    const selectors = document.querySelectorAll('#summary-period-selectors select');
    const year = parseInt(selectors[0]?.value || today.getFullYear(), 10);
    const monthIndex = parseInt(selectors[1]?.value ?? today.getMonth(), 10); // 0-indexed
    const month = String(monthIndex + 1).padStart(2, '0'); // 1-indexed로 변환
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    startDate = `${year}-${month}-01`;
    // 현재 년-월이면 오늘까지, 아니면 말일까지
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed
    if (year === currentYear && monthIndex === currentMonth) {
      endDate = today.toISOString().slice(0, 10);
    } else {
      endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }
    periodLabel = `${year}년 ${monthIndex + 1}월`;
  } else if (mode === 'weekly') {
    // 주별: 선택된 주
    const weekSelect = document.querySelector('#summary-period-selectors select');
    const weekValue = weekSelect?.value;
    if (weekValue) {
      const [year, week] = weekValue.split('-W');
      const jan1 = new Date(year, 0, 1);
      const days = (parseInt(week) - 1) * 7;
      const weekStart = new Date(jan1.getTime() + days * 86400000);
      // 월요일로 조정
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      startDate = weekStart.toISOString().slice(0, 10);
      endDate = weekEnd.toISOString().slice(0, 10);
      periodLabel = `${year}년 ${week}주차`;
    } else {
      startDate = today.toISOString().slice(0, 10);
      endDate = today.toISOString().slice(0, 10);
      periodLabel = '이번 주';
    }
  } else if (mode === 'daily') {
    // 일별: 선택된 날짜
    const dateInput = document.querySelector('#summary-period-selectors input[type="date"]');
    const selectedDate = dateInput?.value || today.toISOString().slice(0, 10);
    startDate = selectedDate;
    endDate = selectedDate;
    periodLabel = selectedDate;
  } else {
    startDate = '2025-12-26';
    endDate = today.toISOString().slice(0, 10);
    periodLabel = '전체';
  }

  // 임시로 report-start-date, report-end-date 설정
  const startInput = document.getElementById('report-start-date');
  const endInput = document.getElementById('report-end-date');

  if (!startInput || !endInput) {
    console.error('report date inputs not found');
    // 모달이 없을 수 있으니 직접 생성
  }

  if (startInput) startInput.value = startDate;
  if (endInput) endInput.value = endDate;

  console.log('Quick Report - startDate:', startDate, 'endDate:', endDate);

  // 해당 기간 데이터 확인
  const posts = filterPostsByDateRange(startDate, endDate);
  if (!posts || posts.length === 0) {
    alert(`선택한 기간(${startDate} ~ ${endDate})에 데이터가 없습니다.\n다른 기간을 선택해주세요.`);
    return;
  }

  // 모달 열고 로딩 표시
  const modal = document.getElementById('report-modal');
  const step1 = document.getElementById('report-step1');
  const step2 = document.getElementById('report-step2');
  const previewEl = document.getElementById('report-preview');

  if (modal && step1 && step2 && previewEl) {
    step1.style.display = 'none';
    step2.style.display = 'block';
    modal.style.display = 'flex';

    // 로딩 표시
    previewEl.innerHTML = `
      <div class="ai-loading-container">
        <div class="loading-spinner"></div>
        <p>AI가 데이터를 분석하고 보고서를 작성하고 있습니다...</p>
        <p class="loading-sub">약 5~10초 소요됩니다</p>
      </div>
    `;

    try {
      // AI 분석 데이터 준비 및 호출 (mode 전달)
      const reportData = prepareReportData(startDate, endDate, mode);
      const aiAnalysis = await analyzeWithGemini(reportData);

      // AI 분석 결과로 보고서 생성 (comparison 정보 전달)
      previewEl.innerHTML = generateReportHTMLWithAI(startDate, endDate, aiAnalysis, reportData.comparison);
    } catch (error) {
      console.error('AI 분석 오류:', error);
      // 오류 시 기본 보고서 생성 (AI 없이)
      previewEl.innerHTML = generateReportHTML(startDate, endDate, mode);
      console.log('기본 보고서로 대체됨');
    }
  }
}

function openReportModal() {
  const modal = document.getElementById('report-modal');
  const step1 = document.getElementById('report-step1');
  const step2 = document.getElementById('report-step2');

  // 기본 날짜 설정 (담당 이후 ~ 오늘)
  const startInput = document.getElementById('report-start-date');
  const endInput = document.getElementById('report-end-date');

  startInput.value = '2025-12-26'; // 담당 시작일
  endInput.value = new Date().toISOString().slice(0, 10); // 오늘

  step1.style.display = 'block';
  step2.style.display = 'none';
  modal.style.display = 'flex';
}

function closeReportModal() {
  document.getElementById('report-modal').style.display = 'none';
}

function filterPostsByDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return DATA.posts.filter(p => {
    const d = parseUploadDate(p.upload_date);
    return d && d >= start && d <= end;
  });
}

// 비교 기간 계산 함수
function getComparisonPeriod(startDate, endDate, mode) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const TAKEOVER_DATE = '2025-12-26'; // 담당 시작일

  let beforeStart, beforeEnd, beforeLabel, afterLabel;

  // 전체평균 모드: 담당 이전 vs 담당 이후
  if (mode === 'all') {
    const allDates = DATA.posts.map(p => parseUploadDate(p.upload_date)).filter(d => d);
    const oldestDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date('2023-01-01');
    beforeStart = oldestDate.toISOString().slice(0, 10);
    beforeEnd = '2025-12-25';
    beforeLabel = `담당 이전 (${beforeStart.slice(2,4)}.${beforeStart.slice(5,7)}.${beforeStart.slice(8,10)} ~ 25.12.25)`;
    afterLabel = `담당 이후 (25.12.26 ~ 현재)`;
    return { beforeStart, beforeEnd, beforeLabel, afterLabel, afterStart: TAKEOVER_DATE, afterEnd: endDate };
  }

  // 년도별: 전년도 vs 선택 년도
  if (mode === 'yearly') {
    const year = start.getFullYear();
    beforeStart = `${year - 1}-01-01`;
    beforeEnd = `${year - 1}-12-31`;
    beforeLabel = `${year - 1}년`;
    afterLabel = `${year}년`;
    return { beforeStart, beforeEnd, beforeLabel, afterLabel, afterStart: startDate, afterEnd: endDate };
  }

  // 월별: 전월 vs 선택 월
  if (mode === 'monthly') {
    const year = start.getFullYear();
    const month = start.getMonth(); // 0-indexed
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    beforeStart = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
    beforeEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;
    beforeLabel = `${prevYear}년 ${prevMonth + 1}월`;
    afterLabel = `${year}년 ${month + 1}월`;
    return { beforeStart, beforeEnd, beforeLabel, afterLabel, afterStart: startDate, afterEnd: endDate };
  }

  // 주별: 전주 vs 선택 주
  if (mode === 'weekly') {
    const prevWeekStart = new Date(start);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);
    beforeStart = prevWeekStart.toISOString().slice(0, 10);
    beforeEnd = prevWeekEnd.toISOString().slice(0, 10);
    beforeLabel = `전주 (${beforeStart.slice(5,7)}.${beforeStart.slice(8,10)} ~ ${beforeEnd.slice(5,7)}.${beforeEnd.slice(8,10)})`;
    afterLabel = `선택주 (${startDate.slice(5,7)}.${startDate.slice(8,10)} ~ ${endDate.slice(5,7)}.${endDate.slice(8,10)})`;
    return { beforeStart, beforeEnd, beforeLabel, afterLabel, afterStart: startDate, afterEnd: endDate };
  }

  // 일별: 전일 vs 선택일
  if (mode === 'daily') {
    const prevDay = new Date(start);
    prevDay.setDate(prevDay.getDate() - 1);
    beforeStart = prevDay.toISOString().slice(0, 10);
    beforeEnd = beforeStart;
    beforeLabel = `전일 (${beforeStart.slice(5,7)}.${beforeStart.slice(8,10)})`;
    afterLabel = `선택일 (${startDate.slice(5,7)}.${startDate.slice(8,10)})`;
    return { beforeStart, beforeEnd, beforeLabel, afterLabel, afterStart: startDate, afterEnd: endDate };
  }

  // 기간 설정 (custom): 직전 동일 기간 vs 선택 기간
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff + 1);
  beforeStart = prevStart.toISOString().slice(0, 10);
  beforeEnd = prevEnd.toISOString().slice(0, 10);
  beforeLabel = `직전 ${daysDiff}일 (${beforeStart.slice(5,7)}.${beforeStart.slice(8,10)} ~ ${beforeEnd.slice(5,7)}.${beforeEnd.slice(8,10)})`;
  afterLabel = `선택 기간 (${startDate.slice(5,7)}.${startDate.slice(8,10)} ~ ${endDate.slice(5,7)}.${endDate.slice(8,10)})`;
  return { beforeStart, beforeEnd, beforeLabel, afterLabel, afterStart: startDate, afterEnd: endDate };
}

// AI 분석을 위한 데이터 준비
function prepareReportData(startDate, endDate, mode = 'custom') {
  const posts = filterPostsByDateRange(startDate, endDate);
  const allPosts = DATA.posts;

  // 비교 기간 계산
  const comparison = getComparisonPeriod(startDate, endDate, mode);

  // 과거 기간 데이터
  const beforePosts = filterPostsByDateRange(comparison.beforeStart, comparison.beforeEnd);
  // 현재 기간 데이터 (전체평균일 때는 담당 이후만)
  const afterPosts = mode === 'all'
    ? filterPostsByDateRange(comparison.afterStart, comparison.afterEnd)
    : posts;

  const formatDate = d => {
    const [y, m, day] = d.split('-');
    return `${y.slice(2)}.${m}.${day}`;
  };
  const periodStr = `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
  const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

  const stats = {
    count: posts.length,
    totalReach: sum(posts.map(p => p.reach || 0)),
    totalLikes: sum(posts.map(p => p.likes || 0)),
    totalSaves: sum(posts.map(p => p.saves || 0)),
    totalShares: sum(posts.map(p => p.shares || 0)),
    totalComments: sum(posts.map(p => p.comments || 0)),
    avgEngRate: avg(posts.map(p => p.engagement_rate).filter(v => v != null)),
  };

  const allStats = {
    totalReach: sum(allPosts.map(p => p.reach || 0)),
    totalLikes: sum(allPosts.map(p => p.likes || 0)),
    totalSaves: sum(allPosts.map(p => p.saves || 0)),
    totalShares: sum(allPosts.map(p => p.shares || 0)),
    totalComments: sum(allPosts.map(p => p.comments || 0)),
  };

  const contribution = {
    reach: allStats.totalReach ? ((stats.totalReach / allStats.totalReach) * 100).toFixed(1) : 0,
    shares: allStats.totalShares ? ((stats.totalShares / allStats.totalShares) * 100).toFixed(1) : 0,
    comments: allStats.totalComments ? ((stats.totalComments / allStats.totalComments) * 100).toFixed(1) : 0,
  };

  const beforeStats = {
    totalReach: sum(beforePosts.map(p => p.reach || 0)),
    totalComments: sum(beforePosts.map(p => p.comments || 0)),
    totalSaves: sum(beforePosts.map(p => p.saves || 0)),
    totalShares: sum(beforePosts.map(p => p.shares || 0)),
  };

  const calcEfficiency = (metric, reach) => reach > 0 ? (metric / reach * 1000) : 0;

  const beforeEfficiency = {
    comments: calcEfficiency(beforeStats.totalComments, beforeStats.totalReach),
    saves: calcEfficiency(beforeStats.totalSaves, beforeStats.totalReach),
    shares: calcEfficiency(beforeStats.totalShares, beforeStats.totalReach),
  };

  // 현재(After) 효율성 - afterPosts 기준
  const afterStats = {
    totalReach: sum(afterPosts.map(p => p.reach || 0)),
    totalComments: sum(afterPosts.map(p => p.comments || 0)),
    totalSaves: sum(afterPosts.map(p => p.saves || 0)),
    totalShares: sum(afterPosts.map(p => p.shares || 0)),
  };

  const afterEfficiency = {
    comments: calcEfficiency(afterStats.totalComments, afterStats.totalReach),
    saves: calcEfficiency(afterStats.totalSaves, afterStats.totalReach),
    shares: calcEfficiency(afterStats.totalShares, afterStats.totalReach),
  };

  const efficiencyMultiplier = {
    comments: beforeEfficiency.comments > 0 ? (afterEfficiency.comments / beforeEfficiency.comments).toFixed(1) : '-',
    saves: beforeEfficiency.saves > 0 ? (afterEfficiency.saves / beforeEfficiency.saves).toFixed(1) : '-',
    shares: beforeEfficiency.shares > 0 ? (afterEfficiency.shares / beforeEfficiency.shares).toFixed(1) : '-',
  };

  const topReach = [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 3);
  const topShares = [...posts].sort((a, b) => (b.shares || 0) - (a.shares || 0)).slice(0, 3);
  const topSaves = [...posts].sort((a, b) => (b.saves || 0) - (a.saves || 0)).slice(0, 3);
  const lowPerf = [...posts].sort((a, b) => (a.engagement_rate || 0) - (b.engagement_rate || 0)).slice(0, 2);

  return {
    period: periodStr,
    daysDiff,
    stats,
    allStats,
    contribution,
    beforeEfficiency,
    afterEfficiency,
    efficiencyMultiplier,
    comparison, // 비교 기간 정보 추가
    topReach,
    topShares,
    topSaves,
    lowPerf
  };
}

// AI 분석 결과를 포함한 보고서 HTML 생성
function generateReportHTMLWithAI(startDate, endDate, aiData, comparison) {
  const posts = filterPostsByDateRange(startDate, endDate);
  const allPosts = DATA.posts;

  // 비교 기간 데이터
  const beforePosts = comparison ? filterPostsByDateRange(comparison.beforeStart, comparison.beforeEnd) : [];
  const afterPosts = comparison ? filterPostsByDateRange(comparison.afterStart, comparison.afterEnd) : posts;

  const formatDate = d => {
    const [y, m, day] = d.split('-');
    return `${y.slice(2)}.${m}.${day}`;
  };
  const periodStr = `${formatDate(startDate)} ~ ${formatDate(endDate)}`;

  const stats = {
    count: posts.length,
    totalReach: sum(posts.map(p => p.reach || 0)),
    totalLikes: sum(posts.map(p => p.likes || 0)),
    totalSaves: sum(posts.map(p => p.saves || 0)),
    totalShares: sum(posts.map(p => p.shares || 0)),
    totalComments: sum(posts.map(p => p.comments || 0)),
    avgEngRate: avg(posts.map(p => p.engagement_rate).filter(v => v != null)),
  };

  const allStats = {
    totalReach: sum(allPosts.map(p => p.reach || 0)),
    totalLikes: sum(allPosts.map(p => p.likes || 0)),
    totalSaves: sum(allPosts.map(p => p.saves || 0)),
    totalShares: sum(allPosts.map(p => p.shares || 0)),
    totalComments: sum(allPosts.map(p => p.comments || 0)),
  };

  const contribution = {
    reach: allStats.totalReach ? ((stats.totalReach / allStats.totalReach) * 100).toFixed(1) : 0,
    shares: allStats.totalShares ? ((stats.totalShares / allStats.totalShares) * 100).toFixed(1) : 0,
    comments: allStats.totalComments ? ((stats.totalComments / allStats.totalComments) * 100).toFixed(1) : 0,
    saves: allStats.totalSaves ? ((stats.totalSaves / allStats.totalSaves) * 100).toFixed(1) : 0,
    likes: allStats.totalLikes ? ((stats.totalLikes / allStats.totalLikes) * 100).toFixed(1) : 0,
  };

  const beforeStats = {
    totalReach: sum(beforePosts.map(p => p.reach || 0)),
    totalComments: sum(beforePosts.map(p => p.comments || 0)),
    totalSaves: sum(beforePosts.map(p => p.saves || 0)),
    totalShares: sum(beforePosts.map(p => p.shares || 0)),
  };

  // afterPosts 기반 통계 (비교용)
  const afterStats = {
    totalReach: sum(afterPosts.map(p => p.reach || 0)),
    totalComments: sum(afterPosts.map(p => p.comments || 0)),
    totalSaves: sum(afterPosts.map(p => p.saves || 0)),
    totalShares: sum(afterPosts.map(p => p.shares || 0)),
  };

  const calcEfficiency = (metric, reach) => reach > 0 ? (metric / reach * 1000) : 0;

  const beforeEfficiency = {
    comments: calcEfficiency(beforeStats.totalComments, beforeStats.totalReach),
    saves: calcEfficiency(beforeStats.totalSaves, beforeStats.totalReach),
    shares: calcEfficiency(beforeStats.totalShares, beforeStats.totalReach),
  };

  const afterEfficiency = {
    comments: calcEfficiency(afterStats.totalComments, afterStats.totalReach),
    saves: calcEfficiency(afterStats.totalSaves, afterStats.totalReach),
    shares: calcEfficiency(afterStats.totalShares, afterStats.totalReach),
  };

  const efficiencyMultiplier = {
    comments: beforeEfficiency.comments > 0 ? (afterEfficiency.comments / beforeEfficiency.comments).toFixed(1) : '-',
    saves: beforeEfficiency.saves > 0 ? (afterEfficiency.saves / beforeEfficiency.saves).toFixed(1) : '-',
    shares: beforeEfficiency.shares > 0 ? (afterEfficiency.shares / beforeEfficiency.shares).toFixed(1) : '-',
  };

  const followerGrowth = DATA.followers && DATA.followers.length >= 2
    ? DATA.followers[DATA.followers.length - 1].followers - DATA.followers[0].followers
    : 0;

  const topReach = [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 3);
  const topShares = [...posts].sort((a, b) => (b.shares || 0) - (a.shares || 0)).slice(0, 3);
  const topSaves = [...posts].sort((a, b) => (b.saves || 0) - (a.saves || 0)).slice(0, 3);
  const lowPerf = [...posts].sort((a, b) => (a.engagement_rate || 0) - (b.engagement_rate || 0)).slice(0, 2);

  // AI 데이터 기본값 설정
  const ai = {
    summary: aiData?.summary || '데이터를 분석 중입니다.',
    performances: aiData?.performances || [{ title: '분석 중', desc: '...' }],
    improvements: aiData?.improvements || [{ title: '분석 중', desc: '...' }],
    contentAnalysis: aiData?.contentAnalysis || {
      highReach: { analysis: '-', strategy: '-' },
      highShare: { analysis: '-', strategy: '-' },
      highSave: { analysis: '-', strategy: '-' },
      lowPerf: { analysis: '-', strategy: '-' }
    },
    nextActions: aiData?.nextActions || ['분석 중...']
  };

  return `
    <div class="report-header">
      <h1>IG CONTENTS REPORT</h1>
      <div class="report-period">${periodStr}</div>
      <div class="report-brand">FLYING JAPAN</div>
    </div>

    <!-- 보고서 생성 안내 -->
    <div class="report-notice">
      <div class="notice-icon">ℹ️</div>
      <div class="notice-content">
        <p class="notice-title">AI 자동 분석 보고서</p>
        <p class="notice-desc">본 보고서는 <strong>Instagram Graph API</strong> 데이터를 기반으로 <strong>Google Gemma AI</strong>가 자동 분석하여 작성되었습니다.</p>
        <p class="notice-warning">⚠️ 각 항목의 ✏️ 아이콘을 클릭하여 내용을 수정할 수 있습니다. <strong>최종 검토 및 수정 후 PDF를 추출</strong>해주세요.</p>
      </div>
    </div>

    <!-- Dynamic Summary (총평) - AI 작성 -->
    <div class="report-section report-summary-section">
      <div class="section-header">
        <span class="info-tooltip" title="AI가 해당 기간의 전체 성과 데이터를 분석하여 작성한 총평입니다. 콘텐츠 수, 도달, 참여율 등을 종합적으로 평가합니다.">ℹ️</span>
      </div>
      <p class="editable-field report-dynamic-summary">
        <span class="edit-icon">✏️</span>
        <span class="editable-content" contenteditable="true">${ai.summary}</span>
      </p>
    </div>

    <!-- 1. 주요 지표별 성과 데이터 -->
    <div class="report-section">
      <h2>1. 주요 지표별 성과 데이터 <span class="info-tooltip" title="선택한 기간 내 발행된 콘텐츠의 도달, 좋아요, 댓글, 저장, 공유 누적 수치입니다. 기여도는 전체 계정 누적 대비 해당 기간의 비율입니다.">ℹ️</span></h2>

      <p class="report-intro">
        현재까지 총 <strong>${stats.count}개</strong>의 콘텐츠를 발행하였으며,<br>
        ${formatDate(endDate)} 기준 주요 누적 수치는 다음과 같습니다.
        <span class="report-follower-note">(팔로워 총 ${fmtNum(followerGrowth)}명 증가)</span>
      </p>

      <table class="report-table">
        <thead>
          <tr>
            <th>지표 항목</th>
            <th>수치 (Total)</th>
            <th>계정 내 점유율 (기여도)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>총 도달 (Reach)</td><td>${fmtNum(stats.totalReach)}회</td><td>전체 누적의 약 <strong>${contribution.reach}%</strong></td></tr>
          <tr><td>총 공유</td><td>${fmtNum(stats.totalShares)}회</td><td>전체 누적의 약 <strong>${contribution.shares}%</strong></td></tr>
          <tr><td>총 저장</td><td>${fmtNum(stats.totalSaves)}</td><td>전체 누적의 약 <strong>${contribution.saves}%</strong></td></tr>
          <tr><td>총 댓글</td><td>${fmtNum(stats.totalComments)}</td><td>전체 누적의 약 <strong>${contribution.comments}%</strong></td></tr>
          <tr><td>총 좋아요</td><td>${fmtNum(stats.totalLikes)}</td><td>전체 누적의 약 <strong>${contribution.likes}%</strong></td></tr>
        </tbody>
      </table>
    </div>

    <!-- 2. 성과 및 개선 필요점 - AI 작성 -->
    <div class="report-section">
      <h2>2. 성과 및 개선 필요점 <span class="info-tooltip" title="AI가 효율성 지표(1,000 도달당 댓글/저장/공유), 기여도 비율, TOP 콘텐츠 성과를 분석하여 도출한 성과와 개선점입니다.">ℹ️</span></h2>

      <div class="report-two-column">
        <div class="report-column report-success">
          <h3>🔺 성과</h3>
          ${ai.performances.map(p => `
          <div class="report-item">
            <h4>${p.title}</h4>
            <p class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${p.desc}</span></p>
          </div>
          `).join('')}
        </div>

        <div class="report-column report-improve">
          <h3>🔻 개선 필요</h3>
          ${ai.improvements.map(i => `
          <div class="report-item">
            <h4>${i.title}</h4>
            <p class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${i.desc}</span></p>
          </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- 3. 과거 대비 효율성 -->
    <div class="report-section">
      <h2>3. 과거 대비 효율성 (1,000 도달당 성과) <span class="info-tooltip" title="${comparison ? `비교 기준: ${comparison.beforeLabel} vs ${comparison.afterLabel}. ` : ''}1,000회 도달당 반응 수로 콘텐츠 질을 평가합니다. [모드별 비교] 전체평균: 담당이전 vs 담당이후 / 년도별: 전년도 vs 선택년도 / 월별: 전월 vs 선택월 / 주별: 전주 vs 선택주 / 일별: 전일 vs 선택일 / 기간설정: 직전 동일기간 vs 선택기간">ℹ️</span></h2>

      <table class="report-table">
        <thead>
          <tr><th>지표</th><th>${comparison ? comparison.beforeLabel : '과거'}</th><th>${comparison ? comparison.afterLabel : '현재'}</th><th>효율 배수</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>1,000 도달당 댓글</td>
            <td>${beforeEfficiency.comments.toFixed(1)}개</td>
            <td>${afterEfficiency.comments.toFixed(1)}개</td>
            <td class="${parseFloat(efficiencyMultiplier.comments) > 1 ? 'positive' : 'negative'}">${efficiencyMultiplier.comments !== '-' ? efficiencyMultiplier.comments + '배' : '-'} ${parseFloat(efficiencyMultiplier.comments) > 1 ? '↑' : parseFloat(efficiencyMultiplier.comments) < 1 ? '↓' : ''}</td>
          </tr>
          <tr>
            <td>1,000 도달당 저장</td>
            <td>${beforeEfficiency.saves.toFixed(1)}개</td>
            <td>${afterEfficiency.saves.toFixed(1)}개</td>
            <td class="${parseFloat(efficiencyMultiplier.saves) > 1 ? 'positive' : 'negative'}">${efficiencyMultiplier.saves !== '-' ? efficiencyMultiplier.saves + '배' : '-'} ${parseFloat(efficiencyMultiplier.saves) > 1 ? '↑' : parseFloat(efficiencyMultiplier.saves) < 1 ? '↓' : ''}</td>
          </tr>
          <tr>
            <td>1,000 도달당 공유</td>
            <td>${beforeEfficiency.shares.toFixed(1)}개</td>
            <td>${afterEfficiency.shares.toFixed(1)}개</td>
            <td class="${parseFloat(efficiencyMultiplier.shares) > 1 ? 'positive' : 'negative'}">${efficiencyMultiplier.shares !== '-' ? efficiencyMultiplier.shares + '배' : '-'} ${parseFloat(efficiencyMultiplier.shares) > 1 ? '↑' : parseFloat(efficiencyMultiplier.shares) < 1 ? '↓' : ''}</td>
          </tr>
        </tbody>
      </table>
      <p class="report-efficiency-note">💡 도달수가 늘어나도 '질적 성과'를 비교할 수 있는 지표입니다.</p>
    </div>

    <!-- 4. 콘텐츠 유형별 성과 분석 - AI 작성 -->
    <div class="report-section">
      <h2>4. 콘텐츠 유형별 성과 분석 <span class="info-tooltip" title="도달/공유/저장 TOP 3 콘텐츠와 저성과 콘텐츠를 분류하고, AI가 각 유형의 성과 원인과 전략을 분석합니다.">ℹ️</span></h2>

      <table class="report-table report-content-table">
        <thead>
          <tr><th style="width:18%">분류</th><th style="width:27%">해당 콘텐츠</th><th style="width:27%">성과 및 분석</th><th style="width:28%">전략</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>High Reach</strong><br>(도달형)</td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${topReach.map(p => '• ' + (p.title || '제목 없음')).join('<br>')}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${ai.contentAnalysis.highReach.analysis}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${ai.contentAnalysis.highReach.strategy}</span></td>
          </tr>
          <tr>
            <td><strong>High Share</strong><br>(확산형)</td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${topShares.map(p => '• ' + (p.title || '제목 없음')).join('<br>')}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${ai.contentAnalysis.highShare.analysis}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${ai.contentAnalysis.highShare.strategy}</span></td>
          </tr>
          <tr>
            <td><strong>High Save</strong><br>(저장형)</td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${topSaves.map(p => '• ' + (p.title || '제목 없음')).join('<br>')}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${ai.contentAnalysis.highSave.analysis}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${ai.contentAnalysis.highSave.strategy}</span></td>
          </tr>
          <tr>
            <td><strong>Low Perf.</strong><br>(개선 필요)</td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${lowPerf.map(p => '• ' + (p.title || '제목 없음')).join('<br>')}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${ai.contentAnalysis.lowPerf.analysis}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${ai.contentAnalysis.lowPerf.strategy}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 5. Next Action - AI 작성 -->
    <div class="report-section report-next-action">
      <h2>5. Next Action <span class="info-tooltip" title="AI가 현재 데이터의 성과/개선점을 바탕으로 다음 기간에 실행할 구체적인 액션 아이템을 제안합니다.">ℹ️</span></h2>
      <div class="editable-field report-action-list">
        <span class="edit-icon">✏️</span>
        <span class="editable-content" contenteditable="true">
          ${ai.nextActions.map((action, idx) => `<p>${idx + 1}. ${action}</p>`).join('\n          ')}
        </span>
      </div>
    </div>

    <!-- 하단 안내 -->
    <div class="report-footer-notice">
      <p>📌 위 내용은 AI가 자동 생성한 초안입니다. 각 항목을 검토하고 필요시 수정한 후 PDF를 추출해주세요.</p>
    </div>
  `;
}

function generateReportHTML(startDate, endDate, mode = 'custom') {
  // ── 비교 기간 계산 ──
  const comparison = getComparisonPeriod(startDate, endDate, mode);

  const posts = filterPostsByDateRange(startDate, endDate);
  const allPosts = DATA.posts;

  // 비교 기간 데이터
  const beforePosts = filterPostsByDateRange(comparison.beforeStart, comparison.beforeEnd);
  const afterPosts = filterPostsByDateRange(comparison.afterStart, comparison.afterEnd);

  // 기간 포맷
  const formatDate = d => {
    const [y, m, day] = d.split('-');
    return `${y.slice(2)}.${m}.${day}`;
  };
  const periodStr = `${formatDate(startDate)} ~ ${formatDate(endDate)}`;

  // 통계 계산 (선택 기간)
  const stats = {
    count: posts.length,
    totalReach: sum(posts.map(p => p.reach || 0)),
    totalLikes: sum(posts.map(p => p.likes || 0)),
    totalSaves: sum(posts.map(p => p.saves || 0)),
    totalShares: sum(posts.map(p => p.shares || 0)),
    totalComments: sum(posts.map(p => p.comments || 0)),
    avgEngRate: avg(posts.map(p => p.engagement_rate).filter(v => v != null)),
    avgSaveRate: avg(posts.map(p => p.save_rate).filter(v => v != null)),
    avgShareRate: avg(posts.map(p => p.share_rate).filter(v => v != null)),
  };

  // 전체 대비 기여도
  const allStats = {
    totalReach: sum(allPosts.map(p => p.reach || 0)),
    totalLikes: sum(allPosts.map(p => p.likes || 0)),
    totalSaves: sum(allPosts.map(p => p.saves || 0)),
    totalShares: sum(allPosts.map(p => p.shares || 0)),
    totalComments: sum(allPosts.map(p => p.comments || 0)),
  };

  const contribution = {
    reach: allStats.totalReach ? ((stats.totalReach / allStats.totalReach) * 100).toFixed(1) : 0,
    shares: allStats.totalShares ? ((stats.totalShares / allStats.totalShares) * 100).toFixed(1) : 0,
    comments: allStats.totalComments ? ((stats.totalComments / allStats.totalComments) * 100).toFixed(1) : 0,
  };

  // Before 통계 (담당 이전)
  const beforeStats = {
    count: beforePosts.length,
    totalReach: sum(beforePosts.map(p => p.reach || 0)),
    totalComments: sum(beforePosts.map(p => p.comments || 0)),
    totalSaves: sum(beforePosts.map(p => p.saves || 0)),
    totalShares: sum(beforePosts.map(p => p.shares || 0)),
    avgEngRate: beforePosts.length ? avg(beforePosts.map(p => p.engagement_rate).filter(v => v != null)) : 0,
    avgSaveRate: beforePosts.length ? avg(beforePosts.map(p => p.save_rate).filter(v => v != null)) : 0,
    avgShareRate: beforePosts.length ? avg(beforePosts.map(p => p.share_rate).filter(v => v != null)) : 0,
  };

  // afterPosts 기반 통계 (비교용)
  const afterStats = {
    totalReach: sum(afterPosts.map(p => p.reach || 0)),
    totalComments: sum(afterPosts.map(p => p.comments || 0)),
    totalSaves: sum(afterPosts.map(p => p.saves || 0)),
    totalShares: sum(afterPosts.map(p => p.shares || 0)),
  };

  // 효율 배수 계산 (1,000 도달당 반응)
  const calcEfficiency = (metric, reach) => reach > 0 ? (metric / reach * 1000) : 0;

  const beforeEfficiency = {
    comments: calcEfficiency(beforeStats.totalComments, beforeStats.totalReach),
    saves: calcEfficiency(beforeStats.totalSaves, beforeStats.totalReach),
    shares: calcEfficiency(beforeStats.totalShares, beforeStats.totalReach),
  };

  const afterEfficiency = {
    comments: calcEfficiency(afterStats.totalComments, afterStats.totalReach),
    saves: calcEfficiency(afterStats.totalSaves, afterStats.totalReach),
    shares: calcEfficiency(afterStats.totalShares, afterStats.totalReach),
  };

  const efficiencyMultiplier = {
    comments: beforeEfficiency.comments > 0 ? (afterEfficiency.comments / beforeEfficiency.comments).toFixed(1) : '-',
    saves: beforeEfficiency.saves > 0 ? (afterEfficiency.saves / beforeEfficiency.saves).toFixed(1) : '-',
    shares: beforeEfficiency.shares > 0 ? (afterEfficiency.shares / beforeEfficiency.shares).toFixed(1) : '-',
  };

  // 팔로워 증가 계산
  const followerGrowth = DATA.followers && DATA.followers.length >= 2
    ? DATA.followers[DATA.followers.length - 1].followers - DATA.followers[0].followers
    : 0;

  // 운영 기간 계산 (일수)
  const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

  // TOP 콘텐츠 분석
  const topReach = [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 3);
  const topShares = [...posts].sort((a, b) => (b.shares || 0) - (a.shares || 0)).slice(0, 3);
  const topSaves = [...posts].sort((a, b) => (b.saves || 0) - (a.saves || 0)).slice(0, 3);
  const lowPerf = [...posts].sort((a, b) => (a.engagement_rate || 0) - (b.engagement_rate || 0)).slice(0, 2);

  // 킬러 콘텐츠 (도달 1위)
  const killerContent = topReach[0];
  const killerNonFollowerRate = killerContent ? ((killerContent.reach - (killerContent.follower_reach || 0)) / killerContent.reach * 100).toFixed(1) : 0;

  // ── 동적 텍스트 생성 로직 ──

  // 1. 총평 자동 생성
  const generateDynamicSummary = () => {
    const commentsRatio = parseFloat(contribution.comments);
    const sharesRatio = parseFloat(contribution.shares);
    const reachRatio = parseFloat(contribution.reach);

    let summaryType = '';
    let highlight = '';

    // 댓글 기여도가 도달 기여도보다 높으면 -> 참여형 계정
    if (commentsRatio > reachRatio) {
      summaryType = '참여형 커뮤니티 계정';
      highlight = `특히 전체 계정 수치 중, 댓글의 <strong>${contribution.comments}%</strong>를 해당 기간 내 기록하고 있어 유저 소통·참여 측면에서 긍정적인 수치로 보고 있습니다.`;
    }
    // 공유 기여도가 도달 기여도보다 높으면 -> 확산형 계정
    else if (sharesRatio > reachRatio) {
      summaryType = '확산형 바이럴 계정';
      highlight = `특히 전체 계정 수치 중, 공유의 <strong>${contribution.shares}%</strong>를 해당 기간 내 기록하며 콘텐츠 확산력이 뛰어난 양상을 보이고 있습니다.`;
    }
    // 도달이 높으면 -> 노출형 계정
    else if (reachRatio > 30) {
      summaryType = '노출 최적화 계정';
      highlight = `전체 계정 도달의 <strong>${contribution.reach}%</strong>를 해당 기간 내 달성하며 인스타그램 알고리즘 노출에 최적화된 모습을 보이고 있습니다.`;
    }
    // 기본값
    else {
      summaryType = '성장 중인 계정';
      highlight = `콘텐츠 발행을 통해 꾸준히 인사이트 수치를 축적해 나가고 있습니다.`;
    }

    return `지난 운영 기간(${daysDiff}일) 동안 총 <strong>${stats.count}개</strong>의 콘텐츠를 발행하며, 정보 전달을 넘어 유저가 능동적으로 참여하고 공유하는 <strong>${summaryType}</strong>으로 나아가고 있습니다. ${highlight}`;
  };

  // 2. 성과/개선 필요점 자동 생성
  const generatePerformanceAnalysis = () => {
    const performances = [];
    const improvements = [];

    const commentsMulti = parseFloat(efficiencyMultiplier.comments) || 0;
    const savesMulti = parseFloat(efficiencyMultiplier.saves) || 0;
    const sharesMulti = parseFloat(efficiencyMultiplier.shares) || 0;

    // 성과 분석
    if (commentsMulti > 1) {
      performances.push({
        title: '댓글 효율 향상',
        desc: `1,000 도달당 댓글 수가 과거 대비 <strong>${efficiencyMultiplier.comments}배</strong> 증가하여, 유저 참여도가 크게 개선되었습니다.`
      });
    }
    if (savesMulti > 1) {
      performances.push({
        title: '저장 효율 향상',
        desc: `1,000 도달당 저장 수가 과거 대비 <strong>${efficiencyMultiplier.saves}배</strong> 증가하여, 콘텐츠의 실용성이 인정받고 있습니다.`
      });
    }
    if (sharesMulti > 1) {
      performances.push({
        title: '공유 효율 향상',
        desc: `1,000 도달당 공유 수가 과거 대비 <strong>${efficiencyMultiplier.shares}배</strong> 증가하여, 바이럴 효과가 강화되고 있습니다.`
      });
    }
    if (parseFloat(killerNonFollowerRate) > 50) {
      performances.push({
        title: '킬러 콘텐츠의 알고리즘 노출 최적화',
        desc: `'${killerContent ? (killerContent.title || '제목 없음') : '-'}'(비팔로워 도달 ${killerNonFollowerRate}%)이 신규 유저 유입에 크게 기여하고 있습니다.`
      });
    }
    if (parseFloat(contribution.comments) > parseFloat(contribution.reach)) {
      performances.push({
        title: '소통·참여형 계정화',
        desc: `전체 도달 비중(${contribution.reach}%) 대비 댓글 비중(${contribution.comments}%)이 높게 나타나며, 적은 비용(도달)으로 최대 효율(댓글)을 취득하고 있습니다.`
      });
    }

    // 개선 필요점 분석
    if (savesMulti < 1 || savesMulti === 0) {
      improvements.push({
        title: '저장률 개선 필요',
        desc: `현재 저장 효율이 과거 대비 낮아, 유저가 나중에 다시 꺼내볼 '실용적' 요소(ex. 요약표 등)를 강화해야 할 것으로 보입니다.`
      });
    }
    if (sharesMulti < 1) {
      improvements.push({
        title: '공유율 개선 필요',
        desc: `공유 효율이 과거 대비 저조하여, "나만 알기 아까운" 정보 콘텐츠 비중을 높일 필요가 있습니다.`
      });
    }
    if (commentsMulti < 1) {
      improvements.push({
        title: '댓글 참여율 개선 필요',
        desc: `댓글 효율이 과거 대비 감소하여, 댓글 유도형 이벤트나 질문형 콘텐츠를 강화할 필요가 있습니다.`
      });
    }
    if (stats.avgEngRate < beforeStats.avgEngRate) {
      improvements.push({
        title: '참여율 하락',
        desc: `평균 참여율이 과거 대비 하락하였습니다. 콘텐츠 소재 다양화 및 후킹 강화가 필요합니다.`
      });
    }

    // 최소 항목 보장
    if (performances.length === 0) {
      performances.push({
        title: '콘텐츠 발행 지속',
        desc: `${stats.count}개의 콘텐츠를 꾸준히 발행하며 계정 활성화를 유지하고 있습니다.`
      });
    }
    if (improvements.length === 0) {
      improvements.push({
        title: '지속적인 모니터링 필요',
        desc: `현재 수치를 유지하면서 추가적인 성장 포인트를 발굴해야 합니다.`
      });
    }

    return { performances: performances.slice(0, 3), improvements: improvements.slice(0, 3) };
  };

  // 3. Next Action 자동 생성
  const generateNextActions = () => {
    const actions = [];
    const savesMulti = parseFloat(efficiencyMultiplier.saves) || 0;
    const sharesMulti = parseFloat(efficiencyMultiplier.shares) || 0;
    const commentsMulti = parseFloat(efficiencyMultiplier.comments) || 0;

    if (savesMulti < 1.5) {
      actions.push("저장율 향상을 위한 '요약 카드' 템플릿 제작");
    }
    if (killerContent && parseFloat(killerNonFollowerRate) > 50) {
      actions.push("주 1회 '대형 브랜드 × 혜택' 콘텐츠 기획 (비팔로워 도달 강화)");
    }
    if (commentsMulti > 1) {
      actions.push("댓글 유도형 이벤트 월 2회 진행 (참여율 유지)");
    } else {
      actions.push("댓글 유도형 이벤트 월 2회 진행 (참여율 개선)");
    }
    if (sharesMulti < 1.5) {
      actions.push("'에티켓', '규제' 시리즈로 바이럴 유도");
    }
    actions.push("프로필 CTA 문구 A/B 테스트");
    actions.push("저성과 콘텐츠 제목 후킹 카피 적용");

    return actions.slice(0, 5);
  };

  const dynamicSummary = generateDynamicSummary();
  const { performances, improvements } = generatePerformanceAnalysis();
  const nextActions = generateNextActions();

  // AI 분석용 데이터 저장 (전역)
  window.currentReportData = {
    period: periodStr,
    stats,
    contribution,
    beforeEfficiency,
    afterEfficiency,
    efficiencyMultiplier,
    topReach,
    topShares,
    topSaves,
    lowPerf,
    killerContent,
    killerNonFollowerRate
  };

  // HTML 생성 (새 양식)
  return `
    <div class="report-header">
      <h1>IG CONTENTS REPORT</h1>
      <div class="report-period">${periodStr}</div>
      <div class="report-brand">FLYING JAPAN</div>
    </div>

    <!-- Dynamic Summary (총평) -->
    <div class="report-section report-summary-section">
      <p class="editable-field report-dynamic-summary">
        <span class="edit-icon">✏️</span>
        <span class="editable-content" contenteditable="true">${dynamicSummary}</span>
      </p>
    </div>

    <!-- 1. 주요 지표별 성과 데이터 -->
    <div class="report-section">
      <h2>1. 주요 지표별 성과 데이터</h2>

      <p class="report-intro">
        현재까지 총 <strong>${stats.count}개</strong>의 콘텐츠를 발행하였으며,<br>
        ${formatDate(endDate)} 기준 주요 누적 수치는 다음과 같습니다.
        <span class="report-follower-note">(팔로워 총 ${fmtNum(followerGrowth)}명 증가)</span>
      </p>

      <table class="report-table">
        <thead>
          <tr>
            <th>지표 항목</th>
            <th>수치 (Total)</th>
            <th>계정 내 점유율 (기여도)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>총 도달 (Reach)</td><td>${fmtNum(stats.totalReach)}회</td><td>전체 누적의 약 <strong>${contribution.reach}%</strong></td></tr>
          <tr><td>총 공유</td><td>${fmtNum(stats.totalShares)}회</td><td>전체 누적의 약 <strong>${contribution.shares}%</strong></td></tr>
          <tr><td>총 저장</td><td>${fmtNum(stats.totalSaves)}</td><td>전체 누적의 약 <strong>${((stats.totalSaves / allStats.totalSaves) * 100).toFixed(1)}%</strong></td></tr>
          <tr><td>총 댓글</td><td>${fmtNum(stats.totalComments)}</td><td>전체 누적의 약 <strong>${contribution.comments}%</strong></td></tr>
          <tr><td>총 좋아요</td><td>${fmtNum(stats.totalLikes)}</td><td>전체 누적의 약 <strong>${((stats.totalLikes / allStats.totalLikes) * 100).toFixed(1)}%</strong></td></tr>
        </tbody>
      </table>
    </div>

    <!-- 2. 성과 및 개선 필요점 -->
    <div class="report-section">
      <h2>2. 성과 및 개선 필요점</h2>

      <div class="report-two-column">
        <div class="report-column report-success">
          <h3>🔺 성과</h3>
          ${performances.map(p => `
          <div class="report-item">
            <h4>${p.title}</h4>
            <p class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${p.desc}</span></p>
          </div>
          `).join('')}
        </div>

        <div class="report-column report-improve">
          <h3>🔻 개선 필요</h3>
          ${improvements.map(i => `
          <div class="report-item">
            <h4>${i.title}</h4>
            <p class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${i.desc}</span></p>
          </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- 3. 과거 대비 효율성 -->
    <div class="report-section">
      <h2>3. 과거 대비 효율성 (1,000 도달당 성과) <span class="info-tooltip" title="${comparison ? `비교 기준: ${comparison.beforeLabel} vs ${comparison.afterLabel}. ` : ''}1,000회 도달당 반응 수로 콘텐츠 질을 평가합니다. [모드별 비교] 전체평균: 담당이전 vs 담당이후 / 년도별: 전년도 vs 선택년도 / 월별: 전월 vs 선택월 / 주별: 전주 vs 선택주 / 일별: 전일 vs 선택일 / 기간설정: 직전 동일기간 vs 선택기간">ℹ️</span></h2>

      <table class="report-table">
        <thead>
          <tr><th>지표</th><th>${comparison ? comparison.beforeLabel : '과거'}</th><th>${comparison ? comparison.afterLabel : '현재'}</th><th>효율 배수</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>1,000 도달당 댓글</td>
            <td>${beforeEfficiency.comments.toFixed(1)}개</td>
            <td>${afterEfficiency.comments.toFixed(1)}개</td>
            <td class="${parseFloat(efficiencyMultiplier.comments) > 1 ? 'positive' : 'negative'}">${efficiencyMultiplier.comments !== '-' ? efficiencyMultiplier.comments + '배' : '-'} ${parseFloat(efficiencyMultiplier.comments) > 1 ? '↑' : parseFloat(efficiencyMultiplier.comments) < 1 ? '↓' : ''}</td>
          </tr>
          <tr>
            <td>1,000 도달당 저장</td>
            <td>${beforeEfficiency.saves.toFixed(1)}개</td>
            <td>${afterEfficiency.saves.toFixed(1)}개</td>
            <td class="${parseFloat(efficiencyMultiplier.saves) > 1 ? 'positive' : 'negative'}">${efficiencyMultiplier.saves !== '-' ? efficiencyMultiplier.saves + '배' : '-'} ${parseFloat(efficiencyMultiplier.saves) > 1 ? '↑' : parseFloat(efficiencyMultiplier.saves) < 1 ? '↓' : ''}</td>
          </tr>
          <tr>
            <td>1,000 도달당 공유</td>
            <td>${beforeEfficiency.shares.toFixed(1)}개</td>
            <td>${afterEfficiency.shares.toFixed(1)}개</td>
            <td class="${parseFloat(efficiencyMultiplier.shares) > 1 ? 'positive' : 'negative'}">${efficiencyMultiplier.shares !== '-' ? efficiencyMultiplier.shares + '배' : '-'} ${parseFloat(efficiencyMultiplier.shares) > 1 ? '↑' : parseFloat(efficiencyMultiplier.shares) < 1 ? '↓' : ''}</td>
          </tr>
        </tbody>
      </table>
      <p class="report-efficiency-note">💡 도달수가 늘어나도 '질적 성과'를 비교할 수 있는 지표입니다.</p>
    </div>

    <!-- 4. 콘텐츠 유형별 성과 분석 -->
    <div class="report-section">
      <h2>4. 콘텐츠 유형별 성과 분석 <span class="info-tooltip" title="도달/공유/저장 TOP 3 콘텐츠와 저성과 콘텐츠를 분류하고, AI가 각 유형의 성과 원인과 전략을 분석합니다.">ℹ️</span></h2>

      <table class="report-table report-content-table">
        <thead>
          <tr><th style="width:18%">분류</th><th style="width:27%">해당 콘텐츠</th><th style="width:27%">성과 및 분석</th><th style="width:28%">전략</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>High Reach</strong><br>(도달형)</td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${topReach.map(p => '• ' + (p.title || '제목 없음')).join('<br>')}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">대중적 브랜드 + 강력한 혜택 후킹으로 비팔로워 유입 극대화</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">강화: 주 1회 이상 대형 브랜드 테마 기획</span></td>
          </tr>
          <tr>
            <td><strong>High Share</strong><br>(확산형)</td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${topShares.map(p => '• ' + (p.title || '제목 없음')).join('<br>')}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">"나만 알기 아까운 정보" 혹은 "친구에게 알려줘야 할 주의사항"</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">유지: '에티켓', '규제' 시리즈로 바이럴 유도</span></td>
          </tr>
          <tr>
            <td><strong>High Save</strong><br>(저장형)</td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${topSaves.map(p => '• ' + (p.title || '제목 없음')).join('<br>')}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">나중에 일본 여행 시 현장에서 꺼내 볼 실무 정보</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">개선: 마지막 장 '요약 카드' 강화로 저장율 상향</span></td>
          </tr>
          <tr>
            <td><strong>Low Perf.</strong><br>(개선 필요)</td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">${lowPerf.map(p => '• ' + (p.title || '제목 없음')).join('<br>')}</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">정보는 유익하나 '이득/손해' 프레임이 부족해 클릭률 저조</span></td>
            <td class="editable-field"><span class="edit-icon">✏️</span><span class="editable-content" contenteditable="true">보완: 제목에 "모르면 손해" 등의 후킹 카피 적용</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 5. Next Action -->
    <div class="report-section report-next-action">
      <h2>5. Next Action <span class="info-tooltip" title="AI가 현재 데이터의 성과/개선점을 바탕으로 다음 기간에 실행할 구체적인 액션 아이템을 제안합니다.">ℹ️</span></h2>
      <div class="editable-field report-action-list">
        <span class="edit-icon">✏️</span>
        <span class="editable-content" contenteditable="true">
          ${nextActions.map((action, idx) => `<p>${idx + 1}. ${action}</p>`).join('\n          ')}
        </span>
      </div>
    </div>
  `;
}

async function generateReport() {
  const startDate = document.getElementById('report-start-date').value;
  const endDate = document.getElementById('report-end-date').value;

  if (!startDate || !endDate) {
    alert('시작일과 종료일을 모두 선택해주세요.');
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    alert('시작일이 종료일보다 늦을 수 없습니다.');
    return;
  }

  const preview = document.getElementById('report-preview');
  const generateBtn = document.querySelector('.report-actions .btn-primary');

  // 로딩 상태 표시
  preview.innerHTML = `
    <div class="ai-loading-container">
      <div class="loading-spinner"></div>
      <p>AI가 데이터를 분석하고 보고서를 작성하고 있습니다...</p>
      <p class="loading-sub">약 5~10초 소요됩니다</p>
    </div>
  `;
  document.getElementById('report-step1').style.display = 'none';
  document.getElementById('report-step2').style.display = 'block';
  if (generateBtn) generateBtn.disabled = true;

  try {
    // AI 분석 데이터 준비 및 호출
    const reportData = prepareReportData(startDate, endDate);
    const aiAnalysis = await analyzeWithGemini(reportData);

    // AI 분석 결과로 보고서 생성
    preview.innerHTML = generateReportHTMLWithAI(startDate, endDate, aiAnalysis);
  } catch (error) {
    console.error('보고서 생성 오류:', error);
    // 오류 시 기본 보고서 생성 (AI 없이)
    preview.innerHTML = generateReportHTML(startDate, endDate);
    alert('AI 분석에 실패하여 기본 보고서를 생성했습니다.');
  } finally {
    if (generateBtn) generateBtn.disabled = false;
  }
}

function downloadReportPDF() {
  const preview = document.getElementById('report-preview');
  const startDate = document.getElementById('report-start-date').value;
  const endDate = document.getElementById('report-end-date').value;

  // 새 창에서 인쇄용 페이지 열기 (브라우저 인쇄 → PDF 저장)
  const printWindow = window.open('', '_blank');

  const printStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans KR', -apple-system, sans-serif;
      color: #1a1a1a;
      line-height: 1.7;
      padding: 40px;
      background: #fff;
    }
    .report-header {
      text-align: center;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2E4A9E;
    }
    .report-header h1 {
      font-size: 26px;
      font-weight: 800;
      color: #2E4A9E;
      margin-bottom: 8px;
      letter-spacing: 2px;
    }
    .report-period { font-size: 15px; color: #666; font-weight: 500; }
    .report-brand { font-size: 12px; color: #999; margin-top: 6px; }

    /* Dynamic Summary */
    .report-summary-section {
      background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
      padding: 20px 24px;
      border-radius: 12px;
      border-left: 5px solid #2E4A9E;
      margin-bottom: 28px;
    }
    .report-dynamic-summary {
      font-size: 14px;
      line-height: 1.9;
      color: #333;
      margin: 0;
    }
    .report-dynamic-summary strong { color: #2E4A9E; }

    .report-section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .report-section h2 {
      font-size: 16px;
      font-weight: 700;
      color: #2E4A9E;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #4A7FD4;
    }
    .report-section h3, .report-subsection-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin: 20px 0 10px;
    }
    .report-section p, .report-section li {
      font-size: 13px;
      color: #444;
      margin-bottom: 8px;
    }
    .report-section ul { padding-left: 20px; }
    .report-section li { margin-bottom: 6px; }

    .report-intro {
      font-size: 13px;
      color: #555;
      margin-bottom: 16px;
      line-height: 1.8;
    }
    .report-follower-note {
      color: #10b981;
      font-weight: 600;
    }

    /* Tables */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 11px;
    }
    .report-table th, .report-table td {
      padding: 10px 12px;
      text-align: left;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .report-table th {
      background: #2E4A9E;
      color: #fff;
      font-weight: 600;
    }
    .report-table tbody tr:nth-child(even) { background: #f8fafc; }
    .report-table tbody tr:nth-child(odd) { background: #fff; }
    .report-table td strong { color: #2E4A9E; }

    .report-improvement-table td:first-child { font-weight: 600; color: #444; }

    /* Two Column Layout */
    .report-two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 16px 0;
    }
    .report-column {
      padding: 16px;
      border-radius: 10px;
    }
    .report-column h3 {
      margin-top: 0;
      font-size: 15px;
      margin-bottom: 12px;
    }
    .report-success {
      background: #f0fdf4;
      border: 1px solid #86efac;
    }
    .report-success h3 { color: #16a34a; }
    .report-improve {
      background: #fef2f2;
      border: 1px solid #fca5a5;
    }
    .report-improve h3 { color: #dc2626; }

    .report-item {
      margin-bottom: 14px;
    }
    .report-item h4 {
      font-size: 12px;
      font-weight: 700;
      color: #333;
      margin-bottom: 6px;
    }
    .report-item p {
      font-size: 11px;
      color: #555;
      margin: 0;
      line-height: 1.6;
    }
    .report-item em {
      color: #2E4A9E;
      font-style: normal;
      font-weight: 600;
    }

    /* Efficiency Table */
    .positive { color: #16a34a; font-weight: 700; }
    .negative { color: #dc2626; font-weight: 700; }
    .report-efficiency-note {
      font-size: 11px;
      color: #888;
      text-align: center;
      margin-top: 8px;
    }

    /* Next Action */
    .report-next-action {
      background: #fffbeb;
      border: 2px solid #fbbf24;
      border-radius: 12px;
      padding: 20px;
    }
    .report-next-action h2 {
      border-bottom: none;
      color: #d97706;
    }
    .report-action-list p {
      margin: 8px 0;
      padding-left: 8px;
      border-left: 3px solid #fbbf24;
    }

    /* Key Insights */
    .report-key-insights {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 20px;
      margin-top: 20px;
    }
    .report-key-insights h3 {
      color: #2E4A9E;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .report-key-insights ul {
      list-style: none;
      padding: 0;
    }
    .report-key-insights li {
      padding: 6px 0 6px 20px;
      position: relative;
    }
    .report-key-insights li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #10b981;
      font-weight: bold;
    }

    .table-resize-hint { display: none; }

    @media print {
      body { padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-section { page-break-inside: avoid; }
      .report-two-column { page-break-inside: avoid; }
    }
  `;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>IG 성과리포트 ${startDate} ~ ${endDate}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>${printStyles}</style>
</head>
<body>
  ${preview.innerHTML}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </` + `script>
</body>
</html>`);

  printWindow.document.close();
}

// 모달 없이 직접 PDF 다운로드 (Quick Report용)
function downloadReportPDFDirect(startDate, endDate, reportHTML) {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
    return;
  }

  const printStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans KR', -apple-system, sans-serif;
      color: #1a1a1a;
      line-height: 1.7;
      padding: 40px;
      background: #fff;
    }
    .report-header {
      text-align: center;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2E4A9E;
    }
    .report-header h1 {
      font-size: 26px;
      font-weight: 800;
      color: #2E4A9E;
      margin-bottom: 8px;
      letter-spacing: 2px;
    }
    .report-period { font-size: 15px; color: #666; font-weight: 500; }
    .report-brand { font-size: 12px; color: #999; margin-top: 6px; }
    .report-summary-section {
      background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
      padding: 20px 24px;
      border-radius: 12px;
      border-left: 5px solid #2E4A9E;
      margin-bottom: 28px;
    }
    .report-dynamic-summary {
      font-size: 14px;
      line-height: 1.9;
      color: #333;
      margin: 0;
    }
    .report-dynamic-summary strong { color: #2E4A9E; }
    .report-section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .report-section h2 {
      font-size: 16px;
      font-weight: 700;
      color: #2E4A9E;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #4A7FD4;
    }
    .report-section h3, .report-subsection-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin: 20px 0 10px;
    }
    .report-section p, .report-section li {
      font-size: 13px;
      color: #444;
      margin-bottom: 8px;
    }
    .report-section ul { padding-left: 20px; }
    .report-section li { margin-bottom: 6px; }
    .report-intro {
      font-size: 13px;
      color: #555;
      margin-bottom: 16px;
      line-height: 1.8;
    }
    .report-follower-note {
      color: #10b981;
      font-weight: 600;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 11px;
    }
    .report-table th, .report-table td {
      padding: 10px 12px;
      text-align: left;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .report-table th {
      background: #2E4A9E;
      color: #fff;
      font-weight: 600;
    }
    .report-table tbody tr:nth-child(even) { background: #f8fafc; }
    .report-table tbody tr:nth-child(odd) { background: #fff; }
    .report-table td strong { color: #2E4A9E; }
    .report-improvement-table td:first-child { font-weight: 600; color: #444; }
    .report-two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 16px 0;
    }
    .report-column {
      padding: 16px;
      border-radius: 10px;
    }
    .report-column h3 {
      margin-top: 0;
      font-size: 15px;
      margin-bottom: 12px;
    }
    .report-success {
      background: #f0fdf4;
      border: 1px solid #86efac;
    }
    .report-success h3 { color: #16a34a; }
    .report-improve {
      background: #fef2f2;
      border: 1px solid #fca5a5;
    }
    .report-improve h3 { color: #dc2626; }
    .report-item {
      margin-bottom: 14px;
    }
    .report-item h4 {
      font-size: 12px;
      font-weight: 700;
      color: #333;
      margin-bottom: 6px;
    }
    .report-item p {
      font-size: 11px;
      color: #555;
      margin: 0;
      line-height: 1.6;
    }
    .report-item em {
      color: #2E4A9E;
      font-style: normal;
      font-weight: 600;
    }
    .positive { color: #16a34a; font-weight: 700; }
    .negative { color: #dc2626; font-weight: 700; }
    .report-efficiency-note {
      font-size: 11px;
      color: #888;
      text-align: center;
      margin-top: 8px;
    }
    .report-next-action {
      background: #fffbeb;
      border: 2px solid #fbbf24;
      border-radius: 12px;
      padding: 20px;
    }
    .report-next-action h2 {
      border-bottom: none;
      color: #d97706;
    }
    .report-action-list p {
      margin: 8px 0;
      padding-left: 8px;
      border-left: 3px solid #fbbf24;
    }
    .report-key-insights {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 20px;
      margin-top: 20px;
    }
    .report-key-insights h3 {
      color: #2E4A9E;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .report-key-insights ul {
      list-style: none;
      padding: 0;
    }
    .report-key-insights li {
      padding: 6px 0 6px 20px;
      position: relative;
    }
    .report-key-insights li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #10b981;
      font-weight: bold;
    }
    .table-resize-hint { display: none; }
    @media print {
      body { padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-section { page-break-inside: avoid; }
      .report-two-column { page-break-inside: avoid; }
    }
  `;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>IG 성과리포트 ${startDate} ~ ${endDate}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>${printStyles}</style>
</head>
<body>
  ${reportHTML}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </` + `script>
</body>
</html>`);

  printWindow.document.close();
}

// ── 보고서 저장/불러오기 ──
const SAVED_REPORTS_KEY = 'ig_saved_reports';

function getSavedReports() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_REPORTS_KEY) || '[]');
  } catch { return []; }
}

function saveReport() {
  const preview = document.getElementById('report-preview');
  const startDate = document.getElementById('report-start-date').value;
  const endDate = document.getElementById('report-end-date').value;

  const reports = getSavedReports();
  const id = Date.now().toString();
  const title = prompt('보고서 제목을 입력하세요:', `${startDate} ~ ${endDate} 리포트`);

  if (!title) return;

  reports.unshift({
    id,
    title,
    startDate,
    endDate,
    html: preview.innerHTML,
    savedAt: new Date().toISOString()
  });

  // 최대 10개까지만 저장
  if (reports.length > 10) reports.pop();

  localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(reports));
  alert('보고서가 저장되었습니다!');
  renderSavedReportsList();
}

function renderSavedReportsList() {
  const reports = getSavedReports();
  const section = document.getElementById('saved-reports-section');
  const list = document.getElementById('saved-reports-list');

  if (!reports.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = reports.map(r => {
    const savedDate = new Date(r.savedAt).toLocaleDateString('ko-KR');
    return `
      <div class="saved-report-item" data-id="${r.id}">
        <div class="saved-report-info">
          <div class="saved-report-title">${r.title}</div>
          <div class="saved-report-date">${r.startDate} ~ ${r.endDate} · 저장: ${savedDate}</div>
        </div>
        <div class="saved-report-actions">
          <button class="btn-view" onclick="loadSavedReport('${r.id}')">보기</button>
          <button class="btn-pdf" onclick="downloadSavedReportPDF('${r.id}')">PDF</button>
          <button class="btn-delete" onclick="deleteSavedReport('${r.id}')">삭제</button>
        </div>
      </div>
    `;
  }).join('');
}

function loadSavedReport(id) {
  const reports = getSavedReports();
  const report = reports.find(r => r.id === id);
  if (!report) return;

  document.getElementById('report-start-date').value = report.startDate;
  document.getElementById('report-end-date').value = report.endDate;
  document.getElementById('report-preview').innerHTML = report.html;

  document.getElementById('report-step1').style.display = 'none';
  document.getElementById('report-step2').style.display = 'block';
}

function downloadSavedReportPDF(id) {
  const reports = getSavedReports();
  const report = reports.find(r => r.id === id);
  if (!report) return;

  // 미리보기에 로드 후 PDF 다운로드
  document.getElementById('report-start-date').value = report.startDate;
  document.getElementById('report-end-date').value = report.endDate;
  document.getElementById('report-preview').innerHTML = report.html;

  document.getElementById('report-step1').style.display = 'none';
  document.getElementById('report-step2').style.display = 'block';

  // 약간의 딜레이 후 PDF 다운로드
  setTimeout(() => downloadReportPDF(), 100);
}

function deleteSavedReport(id) {
  if (!confirm('이 보고서를 삭제하시겠습니까?')) return;

  const reports = getSavedReports().filter(r => r.id !== id);
  localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(reports));
  renderSavedReportsList();
}

// 보고서 모달 이벤트 초기화
function initReportModal() {
  // 바로 다운로드 버튼 (현재 필터 기준)
  document.getElementById('export-report-btn')?.addEventListener('click', downloadQuickReport);

  // 기간 설정 모달 열기
  document.getElementById('custom-report-btn')?.addEventListener('click', openReportModal);

  // 모달 닫기 (X 버튼만으로 닫기 - 외부 클릭으로 닫히지 않음)
  document.getElementById('report-modal-close')?.addEventListener('click', closeReportModal);

  // 기간 프리셋 버튼
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const startInput = document.getElementById('report-start-date');
      const endInput = document.getElementById('report-end-date');
      const today = new Date();

      if (preset === '1month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startInput.value = monthAgo.toISOString().slice(0, 10);
        endInput.value = today.toISOString().slice(0, 10);
      } else if (preset === 'after') {
        startInput.value = '2025-12-26';
        endInput.value = today.toISOString().slice(0, 10);
      } else if (preset === 'thismonth') {
        startInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        endInput.value = today.toISOString().slice(0, 10);
      } else if (preset === 'lastmonth') {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        startInput.value = lastMonth.toISOString().slice(0, 10);
        endInput.value = lastMonthEnd.toISOString().slice(0, 10);
      }
    });
  });

  // 보고서 생성 버튼
  document.getElementById('report-generate-btn')?.addEventListener('click', generateReport);

  // 뒤로가기 버튼
  document.getElementById('report-back-btn')?.addEventListener('click', () => {
    document.getElementById('report-step1').style.display = 'block';
    document.getElementById('report-step2').style.display = 'none';
  });

  // 저장 버튼
  document.getElementById('report-save-btn')?.addEventListener('click', saveReport);

  // PDF 다운로드 버튼
  document.getElementById('report-download-btn')?.addEventListener('click', downloadReportPDF);

  // 저장된 보고서 목록 렌더링
  renderSavedReportsList();
}

// ══════════════════════════════════════════════════
// TAB 5: Content Analysis
// ══════════════════════════════════════════════════

// 지표별 TOP 3 챔피언 카드 (별도 함수로 분리하여 기간 필터 연동)
function renderMetricChampions(posts, periodLabel = '전체') {
  const container = document.getElementById('metric-champions');
  if (!container) return;
  if (!posts || !posts.length) {
    container.innerHTML = '<p style="color:var(--text2);padding:20px;">해당 기간의 데이터가 없습니다.</p>';
    return;
  }

  const metrics = [
    { key: 'reach', label: '도달', icon: '📡', fmt: v => fmt(v) },
    { key: 'views', label: '조회수', icon: '👁', fmt: v => fmt(v) },
    { key: 'likes', label: '좋아요', icon: '❤️', fmt: v => fmt(v) },
    { key: 'saves', label: '저장', icon: '🔖', fmt: v => fmt(v) },
    { key: 'shares', label: '공유', icon: '🔗', fmt: v => fmt(v) },
    { key: 'comments', label: '댓글', icon: '💬', fmt: v => fmt(v) },
    { key: 'engagement_rate', label: '참여율', icon: '🔥', fmt: v => fmtPct(v) },
  ];
  const typeIcon = t => ({ 'CAROUSEL_ALBUM': '🎠', 'VIDEO': '🎬', 'IMAGE': '📸' }[t] || '📄');
  const typeLabel2 = t => ({ 'CAROUSEL_ALBUM': '캐러셀', 'VIDEO': '릴스', 'IMAGE': '이미지' }[t] || '기타');

  // ── 종합 TOP 분석 ──
  // 각 지표별 1위 게시물 찾기
  const topPosts = {};
  metrics.forEach(m => {
    const sorted = [...posts].filter(p => p[m.key] != null).sort((a, b) => b[m.key] - a[m.key]);
    if (sorted.length) topPosts[m.key] = sorted[0];
  });

  // 가장 많이 1위한 게시물 찾기
  const winCount = {};
  Object.values(topPosts).forEach(p => {
    if (!p) return;
    const id = p.url || p.id || p.title;
    if (!winCount[id]) winCount[id] = { post: p, count: 0, metrics: [] };
    winCount[id].count++;
  });
  metrics.forEach(m => {
    const top = topPosts[m.key];
    if (!top) return;
    const id = top.url || top.id || top.title;
    if (winCount[id]) winCount[id].metrics.push(m.label);
  });

  // 종합점수 기준 1위 게시물
  const sortedByScore = [...posts].filter(p => p.composite_score != null).sort((a, b) => b.composite_score - a.composite_score);
  const overallTop = sortedByScore[0];

  // 콘텐츠 추천 인사이트 생성
  let recommendation = '';
  if (overallTop) {
    const topType = typeLabel2(overallTop.media_type);
    const topCategory = overallTop.category || '미분류';

    // 카테고리별 평균 성과
    const catPosts = posts.filter(p => p.category === topCategory);
    const catAvgEng = catPosts.length ? avg(catPosts.map(p => p.engagement_rate).filter(v => v != null)) : 0;

    // 콘텐츠 유형별 평균 성과
    const typePosts = posts.filter(p => p.media_type === overallTop.media_type);
    const typeAvgReach = typePosts.length ? avg(typePosts.map(p => p.reach).filter(v => v != null)) : 0;

    recommendation = `<div class="recommendation-box">`;
    recommendation += `<div class="recommendation-title">💡 콘텐츠 추천</div>`;
    recommendation += `<ul class="recommendation-list">`;
    recommendation += `<li><strong>${topType}</strong> 형식으로 제작 시 평균 도달 ${fmt(Math.round(typeAvgReach))}</li>`;
    recommendation += `<li><strong>${topCategory}</strong> 주제의 참여율 ${catAvgEng.toFixed(1)}%</li>`;
    if (overallTop.media_type === 'CAROUSEL_ALBUM') {
      recommendation += `<li>정보성 콘텐츠 → 저장율 ↑</li>`;
    } else if (overallTop.media_type === 'VIDEO') {
      recommendation += `<li>초반 3초 훅 중요 → 도달 ↑</li>`;
    }
    recommendation += `</ul>`;
    recommendation += `</div>`;
  }

  // 종합 TOP 카드 HTML - 기간 라벨
  let champHtml = `<div class="champion-period-label" style="grid-column:1/-1;font-size:12px;color:var(--text2);margin-bottom:8px;font-weight:500;">📊 기간: ${periodLabel}</div>`;

  // 🏆 종합 TOP 카드 (맨 앞)
  if (overallTop) {
    const titleLink = (p, maxLen = 28) => {
      const t = (p.title || '제목 없음').length > maxLen ? p.title.slice(0, maxLen) + '…' : (p.title || '제목 없음');
      return p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${t}</a>` : t;
    };
    const topId = overallTop.url || overallTop.id || overallTop.title;
    const wins = winCount[topId];
    const winMetrics = wins ? wins.metrics.join(' · ') : '';

    champHtml += `<div class="champion-card champion-overall" style="background:linear-gradient(135deg,#fff9e6 0%,#fff3cd 100%);border:2px solid #ffc107;">`;
    champHtml += `<h4>🏆 종합 TOP <span class="info-tooltip" title="종합점수 산출 기준:\n\n공유 30% + 저장 25% + 도달 25% + 참여율 20%\n\n각 지표를 정규화하여 가중 평균 계산\n(팔로워 성장 최적화 기준)">ⓘ</span></h4>`;
    champHtml += `<div class="champion-first">`;
    champHtml += `<span class="type-icon">${typeIcon(overallTop.media_type)}</span>`;
    champHtml += `<div class="champion-title">${titleLink(overallTop, 40)}</div>`;
    champHtml += `<div class="champion-value" style="font-size:18px;">${overallTop.composite_score?.toFixed(1) || '-'}점</div>`;
    if (overallTop.category) champHtml += `<span class="champion-category">${overallTop.category}</span>`;
    champHtml += `</div>`;
    if (winMetrics) {
      champHtml += `<div class="overall-wins" style="font-size:11px;color:#666;margin-top:8px;padding-top:8px;border-top:1px solid #e0e0e0;">🥇 ${winMetrics} 1위</div>`;
    }
    // 드롭다운 토글 형식 콘텐츠 추천
    champHtml += `<div class="recommendation-toggle" onclick="this.classList.toggle('open')">`;
    champHtml += `<span class="toggle-label">💡 추천 <span class="toggle-arrow">▼</span></span>`;
    champHtml += `<div class="recommendation-content">${recommendation}</div>`;
    champHtml += `</div>`;
    champHtml += `</div>`;
  }

  // 지표별 TOP 카드들 (7개)
  metrics.forEach(m => {
    const sorted = [...posts].filter(p => p[m.key] != null).sort((a, b) => b[m.key] - a[m.key]);
    const top3 = sorted.slice(0, 3);
    if (!top3.length) return;
    const first = top3[0];
    const titleLink = (p, maxLen = 28) => {
      const t = (p.title || '제목 없음').length > maxLen ? p.title.slice(0, maxLen) + '…' : (p.title || '제목 없음');
      return p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${t}</a>` : t;
    };
    champHtml += `<div class="champion-card">`;
    champHtml += `<h4>${m.icon} ${m.label} TOP</h4>`;
    champHtml += `<div class="champion-first">`;
    champHtml += `<span class="type-icon">${typeIcon(first.media_type)}</span>`;
    champHtml += `<div class="champion-title">${titleLink(first, 40)}</div>`;
    champHtml += `<div class="champion-value">${m.fmt(first[m.key])}</div>`;
    if (first.category) champHtml += `<span class="champion-category">${first.category}</span>`;
    champHtml += `</div>`;
    top3.slice(1).forEach((p, i) => {
      champHtml += `<div class="champion-runner">`;
      champHtml += `<span class="runner-rank">${i + 2}</span>`;
      champHtml += `<span class="runner-title">${titleLink(p, 22)}</span>`;
      champHtml += `<span class="runner-value">${m.fmt(p[m.key])}</span>`;
      champHtml += `</div>`;
    });
    champHtml += `</div>`;
  });
  container.innerHTML = champHtml;
}

// 콘텐츠 분석 탭: 인사이트, 차트, TOP 10 테이블 업데이트
function updateContentAnalysis(posts, periodLabel = '전체') {
  if (!posts || !posts.length) {
    document.getElementById('content-insights').innerHTML = '<div class="insight-item" style="color:var(--text2)">해당 기간의 데이터가 없습니다.</div>';
    document.getElementById('chart-content-compare').innerHTML = '<p style="color:var(--text2);text-align:center;padding:40px;">데이터 없음</p>';
    document.getElementById('chart-scatter').innerHTML = '<p style="color:var(--text2);text-align:center;padding:40px;">데이터 없음</p>';
    document.getElementById('top10-table').innerHTML = '<p style="color:var(--text2);padding:20px;">해당 기간의 데이터가 없습니다.</p>';
    return;
  }

  const typeMap = {};
  posts.forEach(p => {
    const t = p.media_type || 'OTHER';
    if (!typeMap[t]) typeMap[t] = [];
    typeMap[t].push(p);
  });

  const typeStats = Object.entries(typeMap).map(([type, items]) => ({
    type,
    label: typeLabel(type),
    count: items.length,
    avgReach: avg(items.map(p => p.reach).filter(v => v != null)),
    avgEngagement: avg(items.map(p => p.engagement_rate).filter(v => v != null)),
    avgSaves: avg(items.map(p => p.saves).filter(v => v != null)),
    avgShares: avg(items.map(p => p.shares).filter(v => v != null)),
    avgSaveRate: avg(items.map(p => p.save_rate).filter(v => v != null)),
    avgShareRate: avg(items.map(p => p.share_rate).filter(v => v != null)),
  }));

  // Insights
  if (typeStats.length > 0) {
    const bestReach = [...typeStats].sort((a, b) => b.avgReach - a.avgReach)[0];
    const bestSaveRate = [...typeStats].sort((a, b) => b.avgSaveRate - a.avgSaveRate)[0];
    const bestShareRate = [...typeStats].sort((a, b) => b.avgShareRate - a.avgShareRate)[0];

    let insightHtml = `<div class="insight-item">`;
    insightHtml += `<span style="font-size:11px;color:var(--text2);background:var(--bg3);padding:2px 8px;border-radius:10px;margin-right:8px;">📊 ${periodLabel}</span><br><br>`;
    insightHtml += `<strong>${bestReach.label}</strong>의 평균 도달이 ${fmt(Math.round(bestReach.avgReach))}으로 가장 높습니다.<br>`;
    insightHtml += `<strong>${bestSaveRate.label}</strong>의 평균 저장율이 ${bestSaveRate.avgSaveRate.toFixed(1)}%로 가장 높습니다. (가치있는 콘텐츠 지표)<br>`;
    insightHtml += `<strong>${bestShareRate.label}</strong>의 평균 공유율이 ${bestShareRate.avgShareRate.toFixed(1)}%로 가장 높습니다. (바이럴 잠재력 지표)`;

    // Compare types
    if (typeStats.length >= 2) {
      const carousel = typeStats.find(t => t.type === 'CAROUSEL_ALBUM');
      const video = typeStats.find(t => t.type === 'VIDEO');
      if (carousel && video) {
        if (carousel.avgSaveRate > video.avgSaveRate && video.avgSaveRate > 0) {
          const ratio = (carousel.avgSaveRate / video.avgSaveRate).toFixed(1);
          insightHtml += `<br><strong>캐러셀</strong>이 릴스보다 저장율이 ${ratio}배 높습니다.`;
        }
        if (video.avgReach > carousel.avgReach && carousel.avgReach > 0) {
          const ratio = (video.avgReach / carousel.avgReach).toFixed(1);
          insightHtml += `<br><strong>릴스</strong>가 캐러셀보다 도달이 ${ratio}배 넓습니다.`;
        }
      }
    }

    // Amplification Ratio (공유÷좋아요 비율) - 바이럴 잠재력 지표
    const totalShares = sum(posts.map(p => p.shares || 0));
    const totalLikes = sum(posts.map(p => p.likes || 0));
    if (totalLikes > 0) {
      const ampRatio = (totalShares / totalLikes).toFixed(2);
      const industryAvg = 0.4; // 업계 평균 0.3~0.5
      const comparison = (ampRatio / industryAvg).toFixed(1);
      insightHtml += `<br><br>📢 <strong>증폭 비율(Amplification Ratio):</strong> ${ampRatio} (공유÷좋아요)`;
      if (ampRatio > industryAvg) {
        insightHtml += `<br>→ 업계 평균 0.3~0.5 대비 <strong style="color:var(--green)">${comparison}배 높은 바이럴력</strong>`;
      } else {
        insightHtml += `<br>→ 업계 평균 수준의 바이럴력`;
      }
    }

    insightHtml += `</div>`;
    document.getElementById('content-insights').innerHTML = insightHtml;
  }

  // Content type comparison grouped bar
  document.getElementById('chart-content-compare').innerHTML = '';
  trackChart(new ApexCharts(document.getElementById('chart-content-compare'), {
    ...chartTheme,
    series: [
      { name: '평균 도달', data: typeStats.map(t => Math.round(t.avgReach)) },
      { name: '평균 저장', data: typeStats.map(t => Math.round(t.avgSaves)) },
      { name: '평균 공유', data: typeStats.map(t => Math.round(t.avgShares)) },
    ],
    chart: { ...chartTheme.chart, type: 'bar', height: 300 },
    xaxis: { categories: typeStats.map(t => t.label) },
    colors: [chartColors.blue, chartColors.green, chartColors.orange],
    plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
    grid: chartTheme.grid,
    tooltip: { ...chartTheme.tooltip, y: { formatter: v => fmt(v) } },
  })).render();

  // Scatter: Reach vs Engagement Rate
  const scatterSeries = Object.entries(typeMap).map(([type, items]) => ({
    name: typeLabel(type),
    data: items.filter(p => p.reach && p.engagement_rate).map(p => ({
      x: p.reach,
      y: p.engagement_rate,
      title: p.title,
    })),
  }));
  document.getElementById('chart-scatter').innerHTML = '';
  trackChart(new ApexCharts(document.getElementById('chart-scatter'), {
    ...chartTheme,
    series: scatterSeries,
    chart: { ...chartTheme.chart, type: 'scatter', height: 300 },
    xaxis: { title: { text: '도달', style: { color: '#9499b3' } }, labels: { formatter: v => fmt(v) } },
    yaxis: { title: { text: '참여율(%)', style: { color: '#9499b3' } }, labels: { formatter: v => v.toFixed(1) + '%' } },
    colors: [chartColors.accent, chartColors.blue, chartColors.green],
    grid: chartTheme.grid,
    tooltip: {
      ...chartTheme.tooltip,
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const p = w.config.series[seriesIndex].data[dataPointIndex];
        return `<div style="padding:8px;font-size:12px"><strong>${p.title || ''}</strong><br>도달: ${fmt(p.x)}<br>참여율: ${p.y.toFixed(1)}%</div>`;
      },
    },
  })).render();

  // Top 10 table - 해당 기간 내에서 종합점수 기준 정렬
  const top10 = [...posts].sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0)).slice(0, 10);
  document.getElementById('top10-table').innerHTML = '';
  new Tabulator('#top10-table', {
    data: top10,
    layout: 'fitColumns',
    movableColumns: true,
    columnDefaults: { headerSortClickElement: 'icon' },
    columns: [
      { title: '#', field: 'rank', width: 45, hozAlign: 'center', formatter: (cell, formatterParams, onRendered) => {
        return cell.getRow().getPosition(true);
      }},
      { title: '유형', field: 'media_type', width: 70, hozAlign: 'center', formatter: cell => typeLabel(cell.getValue()) },
      { title: '카테고리', field: 'category', width: 80 },
      { title: '제목', field: 'title', minWidth: 200,
        formatter: cell => {
          const row = cell.getRow().getData();
          return row.url ? `<a href="${row.url}" target="_blank" style="color:#F77737;text-decoration:none">${cell.getValue()}</a>` : cell.getValue();
        }},
      { title: '도달', field: 'reach', width: 80, hozAlign: 'right', sorter: 'number', formatter: cell => { const v = cell.getValue(); return v == null ? '-' : `<span title="${fmt(v)}">${fmtCell(v)}</span>`; } },
      { title: '참여율', field: 'engagement_rate', width: 70, hozAlign: 'right', formatter: cell => fmtPct(cell.getValue()) },
      { title: '저장', field: 'saves', width: 60, hozAlign: 'right', formatter: cell => { const v = cell.getValue(); return v == null ? '-' : `<span title="${fmt(v)}">${fmtCell(v)}</span>`; } },
      { title: '공유', field: 'shares', width: 60, hozAlign: 'right', formatter: cell => { const v = cell.getValue(); return v == null ? '-' : `<span title="${fmt(v)}">${fmtCell(v)}</span>`; } },
      { title: '점수', field: 'composite_score', width: 60, hozAlign: 'right', formatter: cell => cell.getValue()?.toFixed(1) || '-' },
    ],
  });
}

function renderContent() {
  const posts = filterByMilestone(DATA.posts);

  // 초기 렌더링 (전체 데이터)
  renderMetricChampions(posts, '전체');
  updateContentAnalysis(posts, '전체');

  // Initialize summary section (필터 컨트롤)
  initSummaryControls();
}

// ══════════════════════════════════════════════════
// Post Diagnosis Modal
// ══════════════════════════════════════════════════
function getPercentile(value, arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= value);
  return idx === -1 ? 100 : Math.round((idx / sorted.length) * 100);
}

function diagnosePost(post) {
  const posts = filterByMilestone(DATA.posts);
  const allReach = posts.map(p => p.reach).filter(v => v != null);
  const allEng = posts.map(p => p.engagement_rate).filter(v => v != null);
  const allSaves = posts.map(p => p.saves).filter(v => v != null);
  const allShares = posts.map(p => p.shares).filter(v => v != null);
  const allComments = posts.map(p => p.comments).filter(v => v != null);
  const allViews = posts.map(p => p.views).filter(v => v != null);
  const allSaveRate = posts.map(p => p.save_rate).filter(v => v != null);
  const allShareRate = posts.map(p => p.share_rate).filter(v => v != null);

  const avgReach = avg(allReach);
  const avgEng = avg(allEng);
  const avgSaveR = avg(allSaveRate);
  const avgShareR = avg(allShareRate);
  const avgSaves_ = avg(allSaves);
  const avgShares_ = avg(allShares);
  const avgComments_ = avg(allComments);

  const reachPct = 100 - getPercentile(post.reach || 0, allReach);
  const engPct = 100 - getPercentile(post.engagement_rate || 0, allEng);
  const savePct = 100 - getPercentile(post.saves || 0, allSaves);
  const sharePct = 100 - getPercentile(post.shares || 0, allShares);

  const diags = [];

  // Reach analysis
  if (reachPct <= 5) {
    diags.push({ type: 'good', label: '도달 최상위', text: `도달 ${fmt(post.reach)} — 상위 ${reachPct}% (평균의 ${(post.reach/avgReach).toFixed(1)}배). 알고리즘이 강하게 추천한 콘텐츠입니다.` });
  } else if (reachPct <= 20) {
    diags.push({ type: 'good', label: '도달 우수', text: `도달 ${fmt(post.reach)} — 상위 ${reachPct}% (평균 ${fmt(Math.round(avgReach))}). 탐색 탭 노출 가능성이 높습니다.` });
  } else if (reachPct >= 70) {
    diags.push({ type: 'bad', label: '도달 부족', text: `도달 ${fmt(post.reach)} — 하위 ${100-reachPct}% (평균 ${fmt(Math.round(avgReach))}). 해시태그, 후킹 이미지, 업로드 시간대를 점검해보세요.` });
  }

  // Engagement analysis
  if (post.engagement_rate != null) {
    if (post.engagement_rate >= avgEng * 2) {
      diags.push({ type: 'good', label: '참여율 탁월', text: `참여율 ${post.engagement_rate.toFixed(1)}% — 평균(${avgEng.toFixed(1)}%)의 ${(post.engagement_rate/avgEng).toFixed(1)}배. 팔로워의 공감을 크게 이끈 콘텐츠입니다.` });
    } else if (post.engagement_rate < avgEng * 0.5) {
      diags.push({ type: 'bad', label: '참여율 저조', text: `참여율 ${post.engagement_rate.toFixed(1)}% — 평균(${avgEng.toFixed(1)}%)의 절반 이하. CTA 문구나 질문형 캡션 추가를 권장합니다.` });
    }
  }

  // Save rate (content value)
  if (post.save_rate != null) {
    if (post.save_rate >= avgSaveR * 2) {
      diags.push({ type: 'good', label: '저장율 높음 (콘텐츠 가치)', text: `저장율 ${post.save_rate.toFixed(1)}% — 평균(${avgSaveR.toFixed(1)}%)의 ${(post.save_rate/avgSaveR).toFixed(1)}배. 정보성/실용성이 뛰어난 콘텐츠입니다. 이 유형을 더 만들어보세요.` });
    } else if (post.save_rate < avgSaveR * 0.3) {
      diags.push({ type: 'warn', label: '저장율 낮음', text: `저장율 ${post.save_rate.toFixed(1)}% — 평균(${avgSaveR.toFixed(1)}%)보다 낮습니다. 정보 요약, 꿀팁, 체크리스트 등 "저장할 만한" 요소를 추가해보세요.` });
    }
  }

  // Share rate (viral potential)
  if (post.share_rate != null) {
    if (post.share_rate >= avgShareR * 2) {
      diags.push({ type: 'good', label: '공유율 높음 (바이럴)', text: `공유율 ${post.share_rate.toFixed(1)}% — 평균(${avgShareR.toFixed(1)}%)의 ${(post.share_rate/avgShareR).toFixed(1)}배. 바이럴 잠재력이 큰 콘텐츠입니다.` });
    } else if (post.share_rate < avgShareR * 0.3) {
      diags.push({ type: 'warn', label: '공유율 낮음', text: `공유율 ${post.share_rate.toFixed(1)}% — "친구 태그해!" 같은 공유 유도 CTA를 추가해보세요.` });
    }
  }

  // High reach but low engagement = hook problem
  if (reachPct <= 20 && engPct >= 60) {
    diags.push({ type: 'warn', label: '도달 대비 참여 부족', text: `도달은 높지만 참여가 낮습니다. 많은 사람에게 노출되었지만 반응을 이끌지 못했습니다. 캡션/CTA를 강화하거나, 댓글 유도 질문을 넣어보세요.` });
  }

  // Low reach but high engagement = loyal audience
  if (reachPct >= 60 && engPct <= 20) {
    diags.push({ type: 'warn', label: '참여는 높지만 노출 부족', text: `기존 팔로워의 반응은 좋지만 새로운 사람에게 도달하지 못했습니다. 트렌딩 해시태그나 릴스 형식 활용을 고려해보세요.` });
  }

  // Comments analysis
  if (post.comments != null && post.comments >= avgComments_ * 3) {
    diags.push({ type: 'good', label: '댓글 활발', text: `댓글 ${fmt(post.comments)}개 — 평균(${fmt(Math.round(avgComments_))})의 ${(post.comments/avgComments_).toFixed(1)}배. 소통이 활발한 게시물입니다.` });
  }

  // Overall summary
  const scores = [];
  if (reachPct <= 30) scores.push('도달');
  if (engPct <= 30) scores.push('참여');
  if (savePct <= 30) scores.push('저장');
  if (sharePct <= 30) scores.push('공유');

  if (scores.length >= 3) {
    diags.unshift({ type: 'good', label: '종합 우수 게시물', text: `${scores.join(', ')} 모두 상위권입니다. 이 게시물의 주제/형식을 참고하여 유사 콘텐츠를 제작해보세요.` });
  }

  if (diags.length === 0) {
    diags.push({ type: 'warn', label: '평균 수준', text: '대부분의 지표가 평균 범위 내에 있습니다. 눈에 띄는 강점이나 약점이 없는 안정적인 게시물입니다.' });
  }

  return { reachPct, engPct, savePct, sharePct, diags };
}

function showPostModal(post) {
  const { reachPct, engPct, savePct, sharePct, diags } = diagnosePost(post);

  document.getElementById('modal-title').textContent = post.title || '제목 없음';
  document.getElementById('modal-meta').textContent =
    `${post.upload_date} · ${typeLabel(post.media_type)} · ${post.category || '미분류'} · 종합순위 ${post.rank || '-'}위`;

  const statColor = pct => pct <= 20 ? 'var(--green)' : pct >= 70 ? 'var(--red)' : 'var(--text)';

  document.getElementById('modal-stats').innerHTML = [
    { label: '도달', value: fmt(post.reach), sub: `상위 ${reachPct}%`, color: statColor(reachPct) },
    { label: '참여율', value: fmtPct(post.engagement_rate), sub: `상위 ${engPct}%`, color: statColor(engPct) },
    { label: '저장', value: fmt(post.saves), sub: `상위 ${savePct}%`, color: statColor(savePct) },
    { label: '공유', value: fmt(post.shares), sub: `상위 ${sharePct}%`, color: statColor(sharePct) },
  ].map(s => `
    <div class="modal-stat">
      <div class="modal-stat-label">${s.label}</div>
      <div class="modal-stat-value" style="color:${s.color}">${s.value}</div>
      <div class="modal-stat-sub" style="color:${s.color}">${s.sub}</div>
    </div>
  `).join('');

  document.getElementById('modal-diagnosis').innerHTML = diags.map(d => `
    <div class="diag-item ${d.type}">
      <div class="diag-label">${d.label}</div>
      <div class="diag-text">${d.text}</div>
    </div>
  `).join('');

  document.getElementById('post-modal').style.display = 'flex';
}

// Close modal
document.addEventListener('click', e => {
  if (e.target.id === 'post-modal' || e.target.id === 'modal-close') {
    document.getElementById('post-modal').style.display = 'none';
  }
});

// ── Manual Update Button ──
const WORKER_URL = '/api/trigger-update';

document.addEventListener('DOMContentLoaded', () => {
  init();

  // Header title click - go to overview tab
  document.getElementById('header-title')?.addEventListener('click', () => {
    switchToTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Export report button - PDF 모달로 연결됨 (initReportModal에서 처리)

  const btn = document.getElementById('manual-update-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!WORKER_URL) {
      window.open('https://github.com/Flying-Japan/IG-INSIGHTS/actions/workflows/daily-insights.yml', '_blank');
      return;
    }

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '요청 중...';

    try {
      const res = await fetch(WORKER_URL, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        btn.textContent = '업데이트 시작됨 ✓';
        btn.style.background = 'linear-gradient(135deg, #00c853, #00e676)';
        setTimeout(() => {
          btn.textContent = original;
          btn.style.background = '';
          btn.disabled = false;
        }, 5000);
      } else {
        throw new Error(data.error || 'Failed');
      }
    } catch (e) {
      btn.textContent = '실패 - 다시 시도';
      btn.style.background = 'linear-gradient(135deg, #ff5252, #ff1744)';
      setTimeout(() => {
        btn.textContent = original;
        btn.style.background = '';
        btn.disabled = false;
      }, 3000);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// 콘텐츠 기획 탭 (Content Planner)
// ══════════════════════════════════════════════════════════════

// 카테고리 검증 함수 (전역)
const VALID_CATEGORIES = ['transport', 'season', 'hotplace', 'tips', 'event', 'breaking'];
function validateCategory(category) {
  if (!category) return 'tips';
  const normalized = category.toLowerCase().trim();
  // "season/hotplace" 같은 형식 처리
  const firstPart = normalized.includes('/') ? normalized.split('/')[0].trim() : normalized;
  return VALID_CATEGORIES.includes(firstPart) ? firstPart : 'tips';
}

let PLANNER_DATA = { plans: [] };

async function loadPlannerData() {
  try {
    const response = await fetch('data/content_plans.json?t=' + Date.now());
    if (response.ok) {
      PLANNER_DATA = await response.json();

      // 사용자가 생성한 콘텐츠도 함께 로드 (localStorage)
      const userPlans = JSON.parse(localStorage.getItem('userGeneratedPlans') || '[]');
      if (userPlans.length > 0) {
        // 중복 제거하면서 사용자 콘텐츠를 앞에 추가
        const existingIds = new Set(PLANNER_DATA.plans.map(p => p.id));
        const newUserPlans = userPlans.filter(p => !existingIds.has(p.id));
        PLANNER_DATA.plans = [...newUserPlans, ...PLANNER_DATA.plans];
      }

      return true;
    }
  } catch (e) {
    console.error('콘텐츠 기획 데이터 로드 실패:', e);
  }
  return false;
}

// 페이지네이션 상태
let plannerCurrentPage = 1;
let plannerPageSize = 30;

function renderPlannerTab() {
  const grid = document.getElementById('planner-grid');
  const emptyEl = document.getElementById('planner-empty');
  const paginationEl = document.getElementById('planner-pagination');

  if (!grid) return;

  const categoryFilter = document.getElementById('planner-category-filter')?.value || 'all';
  const statusFilter = document.getElementById('planner-status-filter')?.value || 'all';

  // 필터링
  let plans = PLANNER_DATA.plans || [];

  // 숨긴 항목 제외
  const hiddenPlans = JSON.parse(localStorage.getItem('hiddenPlannerPlans') || '[]');
  plans = plans.filter(p => !hiddenPlans.includes(p.id));

  if (categoryFilter !== 'all') {
    plans = plans.filter(p => p.category === categoryFilter);
  }
  if (statusFilter !== 'all') {
    plans = plans.filter(p => p.status === statusFilter);
  }

  // 통계 업데이트
  updatePlannerStats();

  if (plans.length === 0) {
    grid.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  // 페이지네이션 계산
  const totalPages = Math.ceil(plans.length / plannerPageSize);

  // 현재 페이지가 총 페이지를 초과하면 조정
  if (plannerCurrentPage > totalPages) {
    plannerCurrentPage = totalPages;
  }

  const startIndex = (plannerCurrentPage - 1) * plannerPageSize;
  const endIndex = startIndex + plannerPageSize;
  const paginatedPlans = plans.slice(startIndex, endIndex);

  // 헤더 + 카드 렌더링 (테이블 구조)
  const headerHtml = `
    <div class="planner-list-header">
      <div class="planner-col col-category">카테고리</div>
      <div class="planner-col col-content">콘텐츠 제목 / 매력 포인트</div>
      <div class="planner-col col-status">상태</div>
      <div class="planner-col col-date">생성일</div>
      <div class="planner-col col-cards">카드</div>
      <div class="planner-col col-actions">관리</div>
    </div>
  `;

  grid.innerHTML = headerHtml + paginatedPlans.map(plan => renderPlannerCard(plan)).join('');

  // 페이지네이션 렌더링
  renderPagination(totalPages, plans.length);

  // 이벤트 바인딩
  bindPlannerCardEvents();
}

// 페이지네이션 렌더링
function renderPagination(totalPages, totalItems) {
  const paginationEl = document.getElementById('planner-pagination');
  const numbersEl = document.getElementById('pagination-numbers');
  const prevBtn = document.getElementById('pagination-prev');
  const nextBtn = document.getElementById('pagination-next');

  if (!paginationEl || !numbersEl) return;

  // 1페이지만 있으면 페이지네이션 숨김
  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = 'flex';

  // 이전/다음 버튼 상태
  prevBtn.disabled = plannerCurrentPage === 1;
  nextBtn.disabled = plannerCurrentPage === totalPages;

  // 페이지 번호 생성
  let numbersHtml = '';
  const maxVisiblePages = 7;

  if (totalPages <= maxVisiblePages) {
    // 전체 페이지가 적으면 모두 표시
    for (let i = 1; i <= totalPages; i++) {
      numbersHtml += `<button class="pagination-number ${i === plannerCurrentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
  } else {
    // 페이지가 많으면 ... 사용
    const showFirst = plannerCurrentPage > 3;
    const showLast = plannerCurrentPage < totalPages - 2;

    if (showFirst) {
      numbersHtml += `<button class="pagination-number" data-page="1">1</button>`;
      if (plannerCurrentPage > 4) {
        numbersHtml += `<span class="pagination-ellipsis">...</span>`;
      }
    }

    // 현재 페이지 주변 표시
    const start = Math.max(1, plannerCurrentPage - 2);
    const end = Math.min(totalPages, plannerCurrentPage + 2);

    for (let i = start; i <= end; i++) {
      numbersHtml += `<button class="pagination-number ${i === plannerCurrentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (showLast) {
      if (plannerCurrentPage < totalPages - 3) {
        numbersHtml += `<span class="pagination-ellipsis">...</span>`;
      }
      numbersHtml += `<button class="pagination-number" data-page="${totalPages}">${totalPages}</button>`;
    }
  }

  numbersEl.innerHTML = numbersHtml;

  // 페이지 번호 클릭 이벤트
  numbersEl.querySelectorAll('.pagination-number').forEach(btn => {
    btn.addEventListener('click', () => {
      plannerCurrentPage = parseInt(btn.dataset.page);
      renderPlannerTab();
      // 스크롤 상단으로
      document.getElementById('planner-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// 콘텐츠 기획 탭 초기화 (탭 전환 시 자동 로드)
function initPlannerTabOnSwitch() {
  const plannerTab = document.getElementById('tab-planner');
  if (plannerTab && plannerTab.style.display !== 'none' && !PLANNER_DATA.plans) {
    loadPlannerData().then(loaded => {
      if (loaded) renderPlannerTab();
    });
  }
}

function renderPlannerCard(plan) {
  const categoryLabels = {
    breaking: '🚨 속보',
    transport: '🚄 교통',
    season: '🌸 시즌',
    hotplace: '📍 핫플',
    tips: '💡 팁',
    event: '🎉 이벤트'
  };

  const priorityLabels = {
    high: '⬆️ 상',
    medium: '➡️ 중',
    low: '⬇️ 하'
  };

  // 카테고리 검증 후 라벨 표시
  const validCategory = validateCategory(plan.category);
  const categoryLabel = categoryLabels[validCategory];
  const date = new Date(plan.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

  // 새 형식 (카드뉴스) 또는 구 형식 지원
  const thumbnailTitle = plan.content.thumbnail_title || plan.content.title || '';
  const cards = plan.content.cards || [];

  // relevance 정보
  const relevance = plan.relevance || {};
  const appeal = relevance.appeal || '';

  const savedPlans = JSON.parse(localStorage.getItem('savedPlannerPlans') || '[]');
  const isSaved = savedPlans.includes(plan.id);

  // 사용됨 상태 확인
  const usedPlans = JSON.parse(localStorage.getItem('usedPlannerPlans') || '[]');
  const isUsed = usedPlans.includes(plan.id);

  // 상태 표시 (사용됨 > 저장됨 > 신규)
  let statusClass = 'new';
  let statusLabel = '신규';
  if (isUsed) {
    statusClass = 'used';
    statusLabel = '사용됨';
  } else if (isSaved) {
    statusClass = 'saved';
    statusLabel = '저장됨';
  }

  // 목록(리스트) 형태 UI - 테이블 구조로 정렬
  return `
    <div class="planner-list-item ${statusClass}" data-plan-id="${plan.id}">
      <div class="planner-col col-category">
        <span class="planner-list-category ${validCategory}">${categoryLabel}</span>
      </div>
      <div class="planner-col col-content">
        <h4 class="planner-list-title">${thumbnailTitle.replace(/\n/g, ' ')}</h4>
        ${appeal ? `<p class="planner-list-appeal">${appeal}</p>` : ''}
      </div>
      <div class="planner-col col-status">
        <span class="planner-list-status status-${statusClass}">${statusLabel}</span>
      </div>
      <div class="planner-col col-date">${date}</div>
      <div class="planner-col col-cards">${cards.length + 1}장</div>
      <div class="planner-col col-actions">
        <button class="planner-action-btn detail" data-action="detail" data-plan-id="${plan.id}" title="상세보기">📄</button>
        ${!isUsed ? `<button class="planner-action-btn use" data-action="use" data-plan-id="${plan.id}" title="사용완료">✅</button>` : ''}
        <button class="planner-action-btn copy" data-action="copy" data-plan-id="${plan.id}" title="전체복사">📋</button>
        <button class="planner-action-btn save ${isSaved ? 'saved' : ''}" data-action="save" data-plan-id="${plan.id}" title="저장">
          ${isSaved ? '⭐' : '☆'}
        </button>
        <button class="planner-action-btn hide" data-action="hide" data-plan-id="${plan.id}" title="숨기기">✕</button>
      </div>
    </div>
  `;
}

function updatePlannerStats() {
  const plans = PLANNER_DATA.plans || [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const hiddenPlans = JSON.parse(localStorage.getItem('hiddenPlannerPlans') || '[]');
  const usedPlans = JSON.parse(localStorage.getItem('usedPlannerPlans') || '[]');
  const savedPlans = JSON.parse(localStorage.getItem('savedPlannerPlans') || '[]');

  // 숨긴 항목 제외한 visible plans
  const visiblePlans = plans.filter(p => !hiddenPlans.includes(p.id));

  const totalCount = visiblePlans.length;
  const usedCount = visiblePlans.filter(p => usedPlans.includes(p.id)).length;
  const savedCount = visiblePlans.filter(p => savedPlans.includes(p.id) && !usedPlans.includes(p.id)).length;
  const newCount = visiblePlans.filter(p => !usedPlans.includes(p.id) && !savedPlans.includes(p.id)).length;

  const lastUpdated = PLANNER_DATA.last_updated
    ? new Date(PLANNER_DATA.last_updated).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';

  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };

  el('planner-total-count', totalCount);
  el('planner-new-count', newCount);
  el('planner-used-count', usedCount);
  el('planner-saved-count', savedCount);
  el('planner-update-time', lastUpdated);
}

function bindPlannerCardEvents() {
  document.querySelectorAll('.planner-action-btn').forEach(btn => {
    btn.addEventListener('click', handlePlannerAction);
  });

  document.querySelectorAll('.planner-info-btn').forEach(btn => {
    btn.addEventListener('click', handlePlannerAction);
  });
}

function showSourceInfo(plan, targetBtn) {
  // 기존 팝업 제거
  document.querySelectorAll('.planner-source-popup').forEach(p => p.remove());

  const sourceDate = plan.source.date
    ? new Date(plan.source.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '날짜 정보 없음';

  const popup = document.createElement('div');
  popup.className = 'planner-source-popup';
  popup.innerHTML = `
    <div class="source-popup-content">
      <div class="source-popup-header">📰 출처 정보</div>
      <div class="source-popup-item">
        <span class="source-label">기사 제목</span>
        <span class="source-value">${plan.source.title || '-'}</span>
      </div>
      <div class="source-popup-item">
        <span class="source-label">기사 날짜</span>
        <span class="source-value">${sourceDate}</span>
      </div>
      <div class="source-popup-item">
        <span class="source-label">원문 링크</span>
        <a href="${plan.source.url}" target="_blank" rel="noopener" class="source-link">🔗 원문 보기</a>
      </div>
      <div class="source-popup-item">
        <span class="source-label">기획 생성일</span>
        <span class="source-value">${new Date(plan.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  `;

  // 위치 계산
  const rect = targetBtn.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = `${rect.bottom + 8}px`;
  popup.style.left = `${rect.left - 150}px`;
  popup.style.zIndex = '9999';

  document.body.appendChild(popup);

  // 클릭 외부 시 닫기
  const closePopup = (e) => {
    if (!popup.contains(e.target) && e.target !== targetBtn) {
      popup.remove();
      document.removeEventListener('click', closePopup);
    }
  };
  setTimeout(() => document.addEventListener('click', closePopup), 100);
}

function handlePlannerAction(e) {
  e.stopPropagation();
  const action = e.target.dataset.action;
  const planId = e.target.dataset.planId;
  const plan = PLANNER_DATA.plans.find(p => p.id === planId);

  if (!plan) return;

  switch(action) {
    case 'detail':
      openPlannerDetail(planId);
      break;
    case 'info':
      showSourceInfo(plan, e.target);
      break;
    case 'copy':
      copyPlannerContent(plan);
      break;
    case 'image':
      openImageLinks(plan);
      break;
    case 'save':
      toggleSavePlan(planId, e.target);
      break;
    case 'hide':
      hidePlan(planId);
      break;
    case 'use':
      markAsUsed(planId);
      break;
  }
}

function markAsUsed(planId) {
  let usedPlans = JSON.parse(localStorage.getItem('usedPlannerPlans') || '[]');
  if (!usedPlans.includes(planId)) {
    usedPlans.push(planId);
    localStorage.setItem('usedPlannerPlans', JSON.stringify(usedPlans));
  }
  // UI 업데이트
  const item = document.querySelector(`.planner-list-item[data-plan-id="${planId}"]`);
  if (item) {
    item.classList.remove('new', 'saved');
    item.classList.add('used');
    // 상태 라벨 업데이트
    const statusEl = item.querySelector('.planner-list-status');
    if (statusEl) {
      statusEl.className = 'planner-list-status status-used';
      statusEl.textContent = '사용됨';
    }
    // 사용하기 버튼 제거
    const useBtn = item.querySelector('.planner-action-btn.use');
    if (useBtn) useBtn.remove();
  }
  updatePlannerStats();
  showToast('✅ 사용됨으로 표시되었습니다');
}

function hidePlan(planId) {
  let hiddenPlans = JSON.parse(localStorage.getItem('hiddenPlannerPlans') || '[]');
  if (!hiddenPlans.includes(planId)) {
    hiddenPlans.push(planId);
    localStorage.setItem('hiddenPlannerPlans', JSON.stringify(hiddenPlans));
  }
  // 해당 항목 DOM에서 제거
  const item = document.querySelector(`.planner-list-item[data-plan-id="${planId}"]`);
  if (item) {
    item.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
      item.remove();
      updatePlannerStats();
    }, 300);
  }
  showToast('✕ 목록에서 숨겼습니다');
}

function copyPlannerContent(plan) {
  // 새 형식 (카드뉴스) 또는 구 형식 지원
  const thumbnailTitle = plan.content.thumbnail_title || plan.content.title || '';
  const cards = plan.content.cards || [];
  const caption = plan.content.caption || plan.content.body || '';
  const hashtags = plan.content.hashtags || [];

  // 카드뉴스 텍스트 생성
  const cardsText = cards.length > 0
    ? `[썸네일]\n${thumbnailTitle}\n\n` + cards.map((card, i) => `[카드${i + 1}]\n${card.title}\n${card.content}`).join('\n\n')
    : '';

  const content = cardsText
    ? `${cardsText}\n\n${'─'.repeat(20)}\n\n[본문]\n${caption}\n\n${hashtags.join(' ')}`
    : `${thumbnailTitle}\n\n${caption}\n\n${hashtags.join(' ')}`;

  navigator.clipboard.writeText(content).then(() => {
    showToast('📋 콘텐츠가 클립보드에 복사되었습니다!');
  }).catch(() => {
    showToast('복사 실패 - 수동으로 복사해주세요', 'error');
  });
}

function openImageLinks(plan) {
  const unsplash = plan.image?.unsplash_url;
  const pexels = plan.image?.pexels_url;

  if (unsplash) {
    window.open(unsplash, '_blank');
  }
  if (pexels) {
    setTimeout(() => window.open(pexels, '_blank'), 300);
  }
}

function toggleSavePlan(planId, btn) {
  let savedPlans = JSON.parse(localStorage.getItem('savedPlannerPlans') || '[]');

  if (savedPlans.includes(planId)) {
    savedPlans = savedPlans.filter(id => id !== planId);
    btn.classList.remove('saved');
    btn.textContent = '☆ 저장';
    showToast('저장 목록에서 제거되었습니다');
  } else {
    savedPlans.push(planId);
    btn.classList.add('saved');
    btn.textContent = '⭐ 저장됨';
    showToast('⭐ 저장되었습니다!');
  }

  localStorage.setItem('savedPlannerPlans', JSON.stringify(savedPlans));
}

function openPlannerDetail(planId) {
  const plan = PLANNER_DATA.plans.find(p => p.id === planId);
  if (!plan) return;

  // 기존 모달 제거
  document.getElementById('planner-detail-modal')?.remove();

  const categoryLabels = {
    breaking: '🚨 속보',
    transport: '🚄 교통',
    season: '🌸 시즌',
    hotplace: '📍 핫플',
    tips: '💡 팁',
    event: '🎉 이벤트'
  };

  // 카테고리 검증
  const validCategory = validateCategory(plan.category);

  // 새 형식 (카드뉴스) 또는 구 형식 지원
  const thumbnailTitle = plan.content.thumbnail_title || plan.content.title || '';
  const cards = plan.content.cards || [];
  const caption = plan.content.caption || plan.content.body || '';
  const hashtags = plan.content.hashtags || [];

  // 카드뉴스 HTML 생성 (수정 가능)
  const cardsHtml = `
    <div class="planner-detail-cards">
      <h4>📑 카드뉴스 구성 (${cards.length + 1}장)</h4>
      <div class="card-slides" id="detail-card-slides">
        <div class="card-slide thumbnail">
          <div class="card-slide-number">1</div>
          <div class="card-slide-content">
            <strong>썸네일</strong>
            <textarea class="edit-textarea edit-thumbnail" data-field="thumbnail_title" rows="2">${thumbnailTitle}</textarea>
          </div>
        </div>
        ${cards.map((card, i) => `
          <div class="card-slide">
            <div class="card-slide-number">${i + 2}</div>
            <div class="card-slide-content">
              <input type="text" class="edit-input edit-card-title" data-card-index="${i}" data-field="title" value="${card.title || ''}" placeholder="카드 제목">
              <textarea class="edit-textarea edit-card-content" data-card-index="${i}" data-field="content" rows="3">${card.content || ''}</textarea>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.id = 'planner-detail-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="planner-detail-modal-content">
      <div class="planner-detail-header">
        <span class="planner-card-category ${validCategory}">${categoryLabels[validCategory]}</span>
        <button class="modal-close" id="planner-detail-close">&times;</button>
      </div>
      <div class="planner-detail-body">
        ${cardsHtml}
        ${plan.source?.url ? `
        <div class="planner-detail-section planner-source-section">
          <h4>🔗 원본 기사</h4>
          <a href="${plan.source.url}" target="_blank" rel="noopener" class="source-link">
            <span class="source-title">${plan.source.title || '원본 기사 보기'}</span>
            <span class="source-url">${plan.source.url}</span>
          </a>
        </div>
        ` : ''}
        <div class="planner-detail-section">
          <h4>📝 인스타그램 본문</h4>
          <textarea class="edit-textarea edit-caption" id="detail-caption" rows="12">${caption}</textarea>
        </div>
        <div class="planner-detail-section">
          <h4>🏷️ 해시태그 (${hashtags.length}개)</h4>
          <textarea class="edit-textarea edit-hashtags" id="detail-hashtags" rows="2">${hashtags.join(' ')}</textarea>
        </div>
        <div class="planner-detail-images">
          <h4>🖼️ 무료 이미지 검색</h4>
          <div class="planner-image-links">
            <a href="${plan.image?.unsplash_url || '#'}" target="_blank" rel="noopener">📷 Unsplash에서 검색</a>
            <a href="${plan.image?.pexels_url || '#'}" target="_blank" rel="noopener">📷 Pexels에서 검색</a>
          </div>
        </div>
      </div>
      <div class="planner-detail-footer">
        <div class="footer-left">
          <button class="btn-save" id="planner-save-changes">💾 수정 저장</button>
        </div>
        <div class="footer-right">
          <button class="btn-secondary" id="planner-copy-cards">📑 카드 복사</button>
          <button class="btn-secondary" id="planner-copy-caption">📝 본문 복사</button>
          <button class="btn-primary" id="planner-detail-copy">📋 전체 복사</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 닫기 이벤트
  document.getElementById('planner-detail-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // 수정 저장 버튼
  document.getElementById('planner-save-changes')?.addEventListener('click', () => {
    savePlanChanges(planId);
  });

  // 복사 이벤트
  document.getElementById('planner-detail-copy').addEventListener('click', () => {
    // 현재 입력값으로 복사
    const currentCaption = document.getElementById('detail-caption').value;
    const currentHashtags = document.getElementById('detail-hashtags').value;
    const currentThumbnail = document.querySelector('.edit-thumbnail')?.value || '';
    const currentCards = Array.from(document.querySelectorAll('.card-slide:not(.thumbnail)')).map((slide, i) => {
      return {
        title: slide.querySelector('.edit-card-title')?.value || '',
        content: slide.querySelector('.edit-card-content')?.value || ''
      };
    });

    const cardsText = `[썸네일]\n${currentThumbnail}\n\n` +
      currentCards.map((card, i) => `[카드${i + 1}]\n${card.title}\n${card.content}`).join('\n\n');
    const fullText = `${cardsText}\n\n${'─'.repeat(20)}\n\n[본문]\n${currentCaption}\n\n${currentHashtags}`;

    navigator.clipboard.writeText(fullText).then(() => {
      showToast('📋 전체 콘텐츠가 복사되었습니다!');
    });
  });

  // 카드 텍스트만 복사
  document.getElementById('planner-copy-cards')?.addEventListener('click', () => {
    const currentThumbnail = document.querySelector('.edit-thumbnail')?.value || '';
    const currentCards = Array.from(document.querySelectorAll('.card-slide:not(.thumbnail)')).map((slide, i) => {
      return {
        title: slide.querySelector('.edit-card-title')?.value || '',
        content: slide.querySelector('.edit-card-content')?.value || ''
      };
    });
    const cardsText = `[썸네일]\n${currentThumbnail}\n\n` +
      currentCards.map((card, i) => `[카드${i + 1}]\n${card.title}\n${card.content}`).join('\n\n');
    navigator.clipboard.writeText(cardsText).then(() => {
      showToast('📑 카드 텍스트가 복사되었습니다!');
    });
  });

  // 본문만 복사
  document.getElementById('planner-copy-caption')?.addEventListener('click', () => {
    const currentCaption = document.getElementById('detail-caption').value;
    const currentHashtags = document.getElementById('detail-hashtags').value;
    navigator.clipboard.writeText(currentCaption + '\n\n' + currentHashtags).then(() => {
      showToast('📝 본문이 복사되었습니다!');
    });
  });
}

// 수정 내용 저장 (localStorage에 저장)
function savePlanChanges(planId) {
  const plan = PLANNER_DATA.plans.find(p => p.id === planId);
  if (!plan) return;

  // 현재 입력값 수집
  const newThumbnail = document.querySelector('.edit-thumbnail')?.value || '';
  const newCaption = document.getElementById('detail-caption')?.value || '';
  const newHashtagsStr = document.getElementById('detail-hashtags')?.value || '';
  const newHashtags = newHashtagsStr.split(/\s+/).filter(h => h.startsWith('#'));

  const newCards = Array.from(document.querySelectorAll('.card-slide:not(.thumbnail)')).map((slide) => {
    return {
      title: slide.querySelector('.edit-card-title')?.value || '',
      content: slide.querySelector('.edit-card-content')?.value || ''
    };
  });

  // plan 객체 업데이트
  plan.content.thumbnail_title = newThumbnail;
  plan.content.caption = newCaption;
  plan.content.hashtags = newHashtags;
  plan.content.cards = newCards;

  // localStorage에 수정된 plans 저장
  let editedPlans = JSON.parse(localStorage.getItem('editedPlannerPlans') || '{}');
  editedPlans[planId] = plan.content;
  localStorage.setItem('editedPlannerPlans', JSON.stringify(editedPlans));

  showToast('💾 수정 내용이 저장되었습니다!');

  // 목록 새로고침
  renderPlannerTab();
}

function showToast(message, type = 'success') {
  // 기존 토스트 제거
  document.querySelectorAll('.toast-message').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    padding: 14px 24px;
    background: ${type === 'error' ? '#ff5252' : '#333'};
    color: #fff;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    animation: toastIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// 토스트 애니메이션 CSS 추가
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes toastOut {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(20px); }
  }
`;
document.head.appendChild(toastStyle);

// 콘텐츠 기획 탭 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 탭 전환 시 데이터 로드
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.tab === 'planner') {
        // 로딩 표시
        const grid = document.getElementById('planner-grid');
        if (grid) {
          grid.innerHTML = `<div class="planner-loading"><div class="spinner"></div><p>콘텐츠 기획 데이터를 불러오는 중...</p></div>`;
        }

        // 항상 데이터 새로 로드
        const loaded = await loadPlannerData();
        if (loaded && PLANNER_DATA.plans?.length > 0) {
          renderPlannerTab();
        } else if (loaded && (!PLANNER_DATA.plans || PLANNER_DATA.plans.length === 0)) {
          // 데이터는 로드됐지만 plans가 비어있음
          if (grid) {
            grid.innerHTML = '';
          }
          const emptyEl = document.getElementById('planner-empty');
          if (emptyEl) emptyEl.style.display = 'flex';
        } else {
          // 로드 실패 시 에러 표시
          if (grid) {
            grid.innerHTML = `<div class="planner-loading"><p>❌ 데이터 로드에 실패했습니다. 새로고침을 눌러주세요.</p></div>`;
          }
        }
      }
    });
  });

  // 필터 변경 시 재렌더링
  document.getElementById('planner-category-filter')?.addEventListener('change', renderPlannerTab);
  document.getElementById('planner-status-filter')?.addEventListener('change', renderPlannerTab);

  // 새로고침 버튼
  document.getElementById('planner-refresh-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('planner-refresh-btn');
    btn.textContent = '🔄 로딩...';
    btn.disabled = true;

    await loadPlannerData();
    renderPlannerTab();

    btn.textContent = '🔄 새로고침';
    btn.disabled = false;
    showToast('✅ 콘텐츠 기획이 업데이트되었습니다!');
  });

  // 수동 생성 테스트 버튼 (빈 상태에서)
  document.getElementById('planner-manual-generate')?.addEventListener('click', () => {
    showToast('🤖 콘텐츠 기획은 GitHub Actions로 자동 생성됩니다');
  });

  // 숨긴 항목 복원 버튼
  document.getElementById('planner-restore-btn')?.addEventListener('click', () => {
    showHiddenPlansModal();
  });

  // URL 콘텐츠 생성 버튼
  document.getElementById('planner-url-submit')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('planner-url-input');
    const submitBtn = document.getElementById('planner-url-submit');
    const statusMsg = document.getElementById('url-status-message');
    const url = urlInput?.value?.trim();

    if (!url) {
      showToast('URL을 입력해주세요');
      return;
    }

    // URL 유효성 검사
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast('올바른 URL을 입력해주세요');
      return;
    }

    // 지원되지 않는 URL 체크 (동적 로딩 사이트)
    const unsupportedDomains = [
      'instagram.com', 'www.instagram.com',
      'youtube.com', 'www.youtube.com', 'youtu.be',
      'twitter.com', 'x.com', 'www.x.com',
      'facebook.com', 'www.facebook.com', 'fb.com',
      'tiktok.com', 'www.tiktok.com'
    ];

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      if (unsupportedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
        statusMsg.className = 'url-status-message error';
        statusMsg.innerHTML = '❌ 인스타그램, 유튜브, 트위터 등 SNS URL은 지원되지 않습니다.<br>📰 뉴스 기사나 블로그 URL을 사용해주세요.';
        statusMsg.style.display = 'block';
        return;
      }
    } catch (e) {
      showToast('올바른 URL을 입력해주세요');
      return;
    }

    // 버튼 상태 변경
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';

    // 상태 메시지 표시
    statusMsg.className = 'url-status-message loading';
    statusMsg.innerHTML = '⏳ AI가 콘텐츠를 생성하는 중입니다...';
    statusMsg.style.display = 'block';

    try {
      // 브라우저에서 직접 Gemini API 호출
      const newPlan = await generateContentFromUrl(url);

      if (newPlan) {
        // 로컬 데이터에 추가
        if (!PLANNER_DATA.plans) PLANNER_DATA.plans = [];
        PLANNER_DATA.plans.unshift(newPlan);

        // localStorage에 사용자 생성 콘텐츠 저장
        const userPlans = JSON.parse(localStorage.getItem('userGeneratedPlans') || '[]');
        userPlans.unshift(newPlan);
        localStorage.setItem('userGeneratedPlans', JSON.stringify(userPlans));

        // 화면 업데이트
        renderPlannerTab();

        statusMsg.className = 'url-status-message success';
        statusMsg.innerHTML = '✅ 콘텐츠가 생성되었습니다!';
        urlInput.value = '';

        // 3초 후 메시지 숨김
        setTimeout(() => {
          statusMsg.style.display = 'none';
        }, 3000);
      } else {
        throw new Error('콘텐츠 생성에 실패했습니다');
      }
    } catch (error) {
      console.error('URL content generation error:', error);
      statusMsg.className = 'url-status-message error';
      statusMsg.innerHTML = '❌ 오류: ' + error.message;
    }

    // 버튼 상태 복원
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = 'inline';
    submitBtn.querySelector('.btn-loading').style.display = 'none';
  });

  // Enter 키로 URL 제출
  document.getElementById('planner-url-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('planner-url-submit')?.click();
    }
  });

  // 페이지 사이즈 변경
  document.getElementById('planner-page-size')?.addEventListener('change', (e) => {
    plannerPageSize = parseInt(e.target.value);
    plannerCurrentPage = 1;  // 페이지 사이즈 변경 시 첫 페이지로
    renderPlannerTab();
  });

  // 페이지네이션 이전 버튼
  document.getElementById('pagination-prev')?.addEventListener('click', () => {
    if (plannerCurrentPage > 1) {
      plannerCurrentPage--;
      renderPlannerTab();
      document.getElementById('planner-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // 페이지네이션 다음 버튼
  document.getElementById('pagination-next')?.addEventListener('click', () => {
    const plans = PLANNER_DATA.plans || [];
    const hiddenPlans = JSON.parse(localStorage.getItem('hiddenPlannerPlans') || '[]');
    const visiblePlans = plans.filter(p => !hiddenPlans.includes(p.id));
    const totalPages = Math.ceil(visiblePlans.length / plannerPageSize);

    if (plannerCurrentPage < totalPages) {
      plannerCurrentPage++;
      renderPlannerTab();
      document.getElementById('planner-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // 입력 탭 전환
  document.querySelectorAll('.input-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // 탭 버튼 활성화
      document.querySelectorAll('.input-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // 탭 콘텐츠 표시
      document.querySelectorAll('.input-tab-content').forEach(content => content.classList.remove('active'));
      document.getElementById('input-tab-' + targetTab)?.classList.add('active');

      // 상태 메시지 숨김
      document.getElementById('url-status-message').style.display = 'none';
    });
  });

  // 텍스트 콘텐츠 생성 버튼
  document.getElementById('planner-text-submit')?.addEventListener('click', async () => {
    const textInput = document.getElementById('planner-text-input');
    const submitBtn = document.getElementById('planner-text-submit');
    const statusMsg = document.getElementById('url-status-message');
    const text = textInput?.value?.trim();

    if (!text) {
      showToast('텍스트를 입력해주세요');
      return;
    }

    if (text.length < 20) {
      showToast('텍스트가 너무 짧습니다. 최소 20자 이상 입력해주세요.');
      return;
    }

    // 버튼 상태 변경
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';

    // 상태 메시지 표시
    statusMsg.className = 'url-status-message loading';
    statusMsg.innerHTML = '⏳ AI가 새로운 스타일로 콘텐츠를 재창작하는 중...';
    statusMsg.style.display = 'block';

    try {
      const newPlan = await generateContentFromText(text);

      if (newPlan) {
        // 로컬 데이터에 추가
        if (!PLANNER_DATA.plans) PLANNER_DATA.plans = [];
        PLANNER_DATA.plans.unshift(newPlan);

        // localStorage에 사용자 생성 콘텐츠 저장
        const userPlans = JSON.parse(localStorage.getItem('userGeneratedPlans') || '[]');
        userPlans.unshift(newPlan);
        localStorage.setItem('userGeneratedPlans', JSON.stringify(userPlans));

        // 화면 업데이트
        renderPlannerTab();

        statusMsg.className = 'url-status-message success';
        statusMsg.innerHTML = '✅ 새로운 스타일로 콘텐츠가 재창작되었습니다!';
        textInput.value = '';

        // 3초 후 메시지 숨김
        setTimeout(() => {
          statusMsg.style.display = 'none';
        }, 3000);
      } else {
        throw new Error('콘텐츠 재창작에 실패했습니다');
      }
    } catch (error) {
      console.error('Text content generation error:', error);
      statusMsg.className = 'url-status-message error';
      statusMsg.innerHTML = '❌ 오류: ' + error.message;
    }

    // 버튼 상태 복원
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = 'inline';
    submitBtn.querySelector('.btn-loading').style.display = 'none';
  });

  // URL hash가 #planner인 경우 자동 로드 (직접 접속 시)
  if (window.location.hash === '#planner') {
    setTimeout(async () => {
      const grid = document.getElementById('planner-grid');
      if (grid) {
        grid.innerHTML = `<div class="planner-loading"><div class="spinner"></div><p>콘텐츠 기획 데이터를 불러오는 중...</p></div>`;
      }
      const loaded = await loadPlannerData();
      if (loaded && PLANNER_DATA.plans?.length > 0) {
        renderPlannerTab();
      } else if (loaded) {
        if (grid) grid.innerHTML = '';
        const emptyEl = document.getElementById('planner-empty');
        if (emptyEl) emptyEl.style.display = 'flex';
      } else {
        if (grid) {
          grid.innerHTML = `<div class="planner-loading"><p>❌ 데이터 로드에 실패했습니다. 새로고침을 눌러주세요.</p></div>`;
        }
      }
    }, 100);
  }
});

// 숨긴 항목 복원 모달
function showHiddenPlansModal() {
  const hiddenPlanIds = JSON.parse(localStorage.getItem('hiddenPlannerPlans') || '[]');
  if (hiddenPlanIds.length === 0) {
    showToast('숨긴 항목이 없습니다');
    return;
  }

  // 숨긴 plan 정보 가져오기 (서버 데이터 + 사용자 생성 데이터 모두 포함)
  const userPlans = JSON.parse(localStorage.getItem('userGeneratedPlans') || '[]');
  const allPlans = [...(PLANNER_DATA.plans || []), ...userPlans];
  const hiddenPlans = allPlans.filter(p => hiddenPlanIds.includes(p.id));

  if (hiddenPlans.length === 0) {
    // 데이터에 없는 id만 남아있는 경우 정리
    localStorage.removeItem('hiddenPlannerPlans');
    showToast('숨긴 항목이 없습니다');
    return;
  }

  // 기존 모달 제거
  document.getElementById('planner-hidden-modal')?.remove();

  const categoryLabels = {
    'breaking': '⚡ 속보',
    'transport': '🚆 교통',
    'season': '🌸 시즌',
    'event': '🎉 이벤트',
    'hotplace': '🔥 핫플',
    'tips': '💡 꿀팁'
  };

  const itemsHtml = hiddenPlans.map(plan => {
    const title = (plan.content.thumbnail_title || plan.content.title || '제목 없음').replace(/\n/g, ' ');
    const validCat = validateCategory(plan.category);
    const category = categoryLabels[validCat] || '💡 꿀팁';
    const date = new Date(plan.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

    return `
      <label class="hidden-plan-item">
        <input type="checkbox" value="${plan.id}" class="hidden-plan-checkbox">
        <span class="hidden-plan-category ${validCat}">${category}</span>
        <span class="hidden-plan-title">${title}</span>
        <span class="hidden-plan-date">${date}</span>
      </label>
    `;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'planner-hidden-modal';
  modal.className = 'planner-modal-overlay';
  modal.innerHTML = `
    <div class="planner-hidden-modal-content">
      <div class="planner-hidden-header">
        <h3>👁️ 숨긴 항목 복원</h3>
        <button class="modal-close" id="hidden-modal-close">&times;</button>
      </div>
      <div class="planner-hidden-body">
        <div class="hidden-select-all">
          <label>
            <input type="checkbox" id="hidden-select-all-checkbox">
            <span>전체 선택</span>
          </label>
          <span class="hidden-count">${hiddenPlans.length}개 항목</span>
        </div>
        <div class="hidden-plans-list">
          ${itemsHtml}
        </div>
      </div>
      <div class="planner-hidden-footer">
        <button class="btn-secondary" id="hidden-delete-selected">🗑️ 선택 삭제</button>
        <button class="btn-primary" id="hidden-restore-selected">✅ 선택 복원</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 이벤트 바인딩
  document.getElementById('hidden-modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // 전체 선택
  document.getElementById('hidden-select-all-checkbox').addEventListener('change', (e) => {
    const checkboxes = modal.querySelectorAll('.hidden-plan-checkbox');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
  });

  // 선택 복원
  document.getElementById('hidden-restore-selected').addEventListener('click', () => {
    const selectedIds = Array.from(modal.querySelectorAll('.hidden-plan-checkbox:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) {
      showToast('복원할 항목을 선택해주세요');
      return;
    }

    let hiddenPlans = JSON.parse(localStorage.getItem('hiddenPlannerPlans') || '[]');
    hiddenPlans = hiddenPlans.filter(id => !selectedIds.includes(id));
    localStorage.setItem('hiddenPlannerPlans', JSON.stringify(hiddenPlans));

    modal.remove();
    renderPlannerTab();
    showToast(`👁️ ${selectedIds.length}개 항목이 복원되었습니다`);
  });

  // 선택 삭제 (영구 삭제는 아니고 숨김 목록에서만 제거)
  document.getElementById('hidden-delete-selected').addEventListener('click', () => {
    const selectedIds = Array.from(modal.querySelectorAll('.hidden-plan-checkbox:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) {
      showToast('삭제할 항목을 선택해주세요');
      return;
    }

    // 숨김 목록에서 제거 (복원하지 않고 완전히 무시)
    let hiddenPlans = JSON.parse(localStorage.getItem('hiddenPlannerPlans') || '[]');
    // 선택된 항목은 숨김 목록에서 유지 (영구 숨김 처리)
    showToast(`🗑️ ${selectedIds.length}개 항목이 영구 숨김 처리되었습니다`);
    modal.remove();
  });
}
