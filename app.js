const DATA_URL = './dashboard.json';
const app = document.getElementById('app');
const el = (id) => document.getElementById(id);

let state = {
  data: null,
  query: '',
  sourceType: '',
};

function showError(msg) {
  const box = el('errorBox');
  box.textContent = msg;
  box.style.display = 'block';
}
function clearError() {
  const box = el('errorBox');
  box.textContent = '';
  box.style.display = 'none';
}
function setLoading(on) {
  el('loadingBox').style.display = on ? 'block' : 'none';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function parseHash() {
  const raw = (location.hash || '#/home').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  return { view: parts[0] || 'home', p1: parts[1] || '', p2: parts[2] || '' };
}

function navTo(path) {
  location.hash = path;
}

function SummaryPanel(summary, fallbackTitle = '摘要') {
  const s = summary || {
    title: fallbackTitle,
    one_line_summary: '目前資料不足，待補充。',
    key_points: [],
    what_changed: [],
    risks: [],
    opportunities: [],
    watchlist_status: 'off_watchlist',
    thesis_status: 'intact',
    conviction: '-',
    last_updated: '-',
  };
  return `
    <section class="panel summary-panel">
      <h2>${esc(s.title || fallbackTitle)}</h2>
      <p class="one-line">${esc(s.one_line_summary || '目前資料不足，待補充。')}</p>
      <div class="meta-row">
        <span class="badge">watchlist: ${esc(s.watchlist_status || 'off_watchlist')}</span>
        <span class="badge">thesis: ${esc(s.thesis_status || 'intact')}</span>
        <span class="badge">conviction: ${esc(s.conviction || '-')}</span>
        <span class="badge">updated: ${esc(s.last_updated || '-')}</span>
      </div>
    </section>
  `;
}

function KPIGrid(stats = {}) {
  return `
    <section class="panel">
      <h3>關鍵指標</h3>
      <div class="kpi-grid">
        <div class="kpi"><label>Total Sources</label><strong>${esc(stats.source_count ?? 0)}</strong></div>
        <div class="kpi"><label>Watchlist</label><strong>${esc(stats.watchlist_count ?? 0)}</strong></div>
        <div class="kpi"><label>Thesis Changes</label><strong>${esc(stats.thesis_changes_count ?? 0)}</strong></div>
        <div class="kpi"><label>Uncategorized</label><strong>${esc(stats.untagged_count ?? 0)}</strong></div>
      </div>
    </section>
  `;
}

function BreadcrumbHeader(parts = []) {
  const crumbs = ['Home', ...parts].map((p, i) => {
    if (i === 0) return `<a href="#/home">Home</a>`;
    return `<span>${esc(p)}</span>`;
  }).join(' / ');
  return `<section class="panel breadcrumb">${crumbs}</section>`;
}

function ThesisChangeList(items = []) {
  if (!items.length) return `<section class="panel"><h3>Thesis Changes</h3><div class="empty">近期無 thesis 變動</div></section>`;
  return `
    <section class="panel">
      <h3>Thesis Changes / Important Updates</h3>
      ${items.slice(0, 8).map(t => `
        <div class="list-item clickable" data-company-ticker="${esc(t.ticker || '')}">
          <div><strong>${esc(t.ticker || '-')}</strong> <span class="muted">${esc(t.old_status || '-')} → ${esc(t.new_status || '-')}</span></div>
          <div class="sub">${esc(t.reason || '（待補）')}</div>
        </div>
      `).join('')}
    </section>
  `;
}

function DrilldownCardGrid(title, cards = [], kind = '') {
  if (!cards.length) return `<section class="panel"><h3>${esc(title)}</h3><div class="empty">暫無資料</div></section>`;
  return `
    <section class="panel">
      <h3>${esc(title)}</h3>
      <div class="card-grid">
        ${cards.map(c => `
          <article class="dcard clickable" data-kind="${esc(kind)}" data-slug="${esc(c.slug || '')}">
            <h4>${esc(c.name || c.display_name || c.label || '-')}</h4>
            <p>${esc(c.summary || '（待補）')}</p>
            <div class="meta">count: ${esc(c.count ?? c.related_sources_count ?? 0)} · latest: ${esc(c.latest_update || '-')}</div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function SourceTimeline(items = [], title = 'Recent Sources', limit = 8, showViewAll = false) {
  if (!items.length) return `<section class="panel"><h3>${esc(title)}</h3><div class="empty">此層暫無來源</div></section>`;
  const rows = items.slice(0, limit);
  return `
    <section class="panel">
      <h3>${esc(title)}</h3>
      ${rows.map(s => `
        <div class="list-item clickable" data-source-id="${esc(s.id)}">
          <div><strong>${esc(s.title || '')}</strong> <span class="muted">[${esc(s.source_type || '')}] ${esc(s.date || '')}</span></div>
          <div class="sub">${esc(s.summary || '（待人工摘要）')}</div>
        </div>
      `).join('')}
      ${showViewAll ? `<div class="view-all"><a href="#/sources">View all sources</a></div>` : ''}
    </section>
  `;
}

function WatchlistBadge(items = []) {
  if (!items.length) return `<section class="panel"><h3>Watchlist</h3><div class="empty">暫無 watchlist</div></section>`;
  return `
    <section class="panel">
      <h3>Watchlist</h3>
      ${items.map(w => `
        <div class="list-item clickable" data-company-ticker="${esc(w.ticker || '')}">
          <div><strong>${esc(w.ticker || '-')}</strong> <span class="muted">conviction: ${esc(w.conviction || '-')}</span></div>
          <div class="sub">${esc(w.thesis || w.note || '-')}</div>
        </div>
      `).join('')}
    </section>
  `;
}

function RiskOpportunityPanel(summary = {}) {
  const risks = summary.risks || [];
  const opps = summary.opportunities || [];
  return `
    <section class="panel two-col">
      <div>
        <h4>Risks</h4>
        ${risks.length ? `<ul>${risks.slice(0, 3).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<div class="empty">暫無</div>`}
      </div>
      <div>
        <h4>Opportunities</h4>
        ${opps.length ? `<ul>${opps.slice(0, 3).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<div class="empty">暫無</div>`}
      </div>
    </section>
  `;
}

function DataHealthPanel(stats = {}) {
  return `
    <section class="panel low-priority">
      <h4>Data Health</h4>
      <div class="muted">uncategorized: ${esc(stats.untagged_count ?? 0)} · last updated: ${esc(stats.latest_date || '-')}</div>
    </section>
  `;
}

function searchAndFilterSources(items = [], opts = {}) {
  const q = (opts.query || '').trim().toLowerCase();
  const sourceType = opts.sourceType || '';
  return items.filter(s => {
    const passType = !sourceType || s.source_type === sourceType;
    const text = `${s.title || ''} ${s.summary || ''} ${(s.categories || []).join(' ')} ${(s.company_tags || []).join(' ')} ${(s.sector_tags || []).join(' ')}`.toLowerCase();
    const passQ = !q || text.includes(q);
    return passType && passQ;
  });
}

function byIds(all, ids = []) {
  const set = new Set(ids);
  return all.filter(x => set.has(x.id));
}

function findL1Node(key) {
  return (state.data?.taxonomy || []).find(x => x.l1 === key);
}

function renderHome() {
  const d = state.data;
  const topSectors = (d.sectors_overview || []).map(x => ({
    slug: x.sector_slug,
    name: x.display_name,
    summary: x.summary?.one_line_summary || '（待補）',
    count: x.related_sources_count,
    latest_update: x.latest_update,
  }));
  const topCompanies = (d.companies_overview || []).map(x => ({
    slug: x.company_slug,
    name: x.display_name,
    summary: x.summary?.one_line_summary || `${x.ticker || ''} thesis: ${x.thesis_status || 'intact'}`,
    count: x.related_sources_count,
    latest_update: x.latest_update,
  }));

  const opportunitiesNode = findL1Node('opportunities');
  const oppCards = (opportunitiesNode?.children || []).map(x => ({
    slug: x.l2,
    name: x.l2,
    summary: x.summary?.one_line_summary || '（待補）',
    count: x.count,
    latest_update: x.summary?.last_updated || '-',
  }));

  const sources = searchAndFilterSources(d.sources || [], state);

  app.innerHTML = `
    ${BreadcrumbHeader([])}
    ${renderTopToolbar()}
    ${SummaryPanel(d.home_summary, '全站總結')}
    ${KPIGrid(d.stats)}
    ${RiskOpportunityPanel(d.home_summary || {})}
    ${ThesisChangeList(d.thesis_changes || [])}
    ${DrilldownCardGrid('Top Sectors', topSectors, 'sector')}
    ${DrilldownCardGrid('Top Companies', topCompanies, 'company')}
    ${DrilldownCardGrid('Opportunities', oppCards, 'opportunity')}
    ${SourceTimeline(sources, 'Recent Sources', 8, true)}
    ${DataHealthPanel(d.stats)}
  `;
}

function renderTopToolbar() {
  return `
    <section class="panel toolbar">
      <input id="searchInput" placeholder="Search title / summary / tags" value="${esc(state.query)}" />
      <select id="sourceTypeFilter">
        <option value="">全部來源</option>
        <option value="report" ${state.sourceType === 'report' ? 'selected' : ''}>report</option>
        <option value="youtube" ${state.sourceType === 'youtube' ? 'selected' : ''}>youtube</option>
        <option value="book" ${state.sourceType === 'book' ? 'selected' : ''}>book</option>
        <option value="news" ${state.sourceType === 'news' ? 'selected' : ''}>news</option>
        <option value="note" ${state.sourceType === 'note' ? 'selected' : ''}>note</option>
      </select>
      <div class="muted">sync: ready · last updated: ${esc(state.data?.generated_at || '-')}</div>
    </section>
  `;
}

function renderCategory(l1) {
  const node = findL1Node(l1);
  const label = node?.label || l1;
  const childCards = (node?.children || []).map(c => ({
    slug: c.l2,
    name: c.l2,
    summary: c.summary?.one_line_summary || '（待補）',
    count: c.count,
    latest_update: c.summary?.last_updated || '-',
  }));
  const sourceIds = (node?.children || []).flatMap(c => c.source_ids || []);
  const src = searchAndFilterSources(byIds(state.data.sources || [], sourceIds), state);

  app.innerHTML = `
    ${BreadcrumbHeader([label])}
    ${renderTopToolbar()}
    ${SummaryPanel(node?.summary, `${label} 總結`)}
    ${KPIGrid({ source_count: src.length, watchlist_count: state.data.stats.watchlist_count, thesis_changes_count: (state.data.thesis_changes || []).length, untagged_count: state.data.stats.untagged_count })}
    ${RiskOpportunityPanel(node?.summary || {})}
    ${ThesisChangeList((state.data.thesis_changes || []))}
    ${DrilldownCardGrid(`${label} 子分類`, childCards, 'l2')}
    ${SourceTimeline(src, `${label} 相關來源`, 20, false)}
  `;
}

function renderSector(slug) {
  const sectors = state.data.sectors_overview || [];
  const sec = sectors.find(x => x.sector_slug === slug) || sectors.find(x => slugify(x.display_name) === slug);
  if (!sec) return renderEmptyView(`找不到 sector：${slug}`);
  const src = searchAndFilterSources(byIds(state.data.sources || [], sec.source_ids || []), state);
  const relatedCompanies = (state.data.companies_overview || []).filter(c => c.primary_sector === sec.display_name);
  app.innerHTML = `
    ${BreadcrumbHeader(['Sectors', sec.display_name])}
    ${renderTopToolbar()}
    ${SummaryPanel(sec.summary, `${sec.display_name} 概覽`)}
    ${KPIGrid({ source_count: sec.related_sources_count, watchlist_count: relatedCompanies.filter(c => c.watchlist_status === 'on_watchlist').length, thesis_changes_count: (state.data.thesis_changes || []).filter(c => relatedCompanies.some(rc => rc.ticker === c.ticker)).length, untagged_count: 0 })}
    ${RiskOpportunityPanel(sec.summary || {})}
    ${ThesisChangeList((state.data.thesis_changes || []).filter(c => relatedCompanies.some(rc => rc.ticker === c.ticker)))}
    ${DrilldownCardGrid('Related Companies', relatedCompanies.map(c => ({ slug: c.company_slug, name: c.display_name, summary: c.summary?.one_line_summary || `${c.ticker} thesis: ${c.thesis_status}`, count: c.related_sources_count, latest_update: c.latest_update })), 'company')}
    ${SourceTimeline(src, 'Underlying Sources / Items', 20, false)}
  `;
}

function renderCompany(slug) {
  const companies = state.data.companies_overview || [];
  const c = companies.find(x => x.company_slug === slug) || companies.find(x => slugify(x.ticker) === slug) || companies.find(x => x.ticker === slug);
  if (!c) return renderEmptyView(`找不到 company：${slug}`);
  const src = searchAndFilterSources(byIds(state.data.sources || [], c.source_ids || []), state);
  const changes = (state.data.thesis_changes || []).filter(t => t.ticker === c.ticker || t.ticker === c.display_name);
  const watch = (state.data.watchlist || []).filter(w => w.ticker === c.ticker || w.ticker === c.display_name);

  app.innerHTML = `
    ${BreadcrumbHeader(['Companies', c.display_name])}
    ${renderTopToolbar()}
    ${SummaryPanel(c.summary, `${c.display_name} 概覽`)}
    ${KPIGrid({ source_count: c.related_sources_count, watchlist_count: watch.length, thesis_changes_count: changes.length, untagged_count: 0 })}
    ${RiskOpportunityPanel(c.summary || {})}
    ${ThesisChangeList(changes)}
    ${DrilldownCardGrid('Related Sectors', [{ slug: slugify(c.primary_sector || '未分類行業'), name: c.primary_sector || '未分類行業', summary: `${c.display_name} primary sector`, count: c.related_sources_count, latest_update: c.latest_update }], 'sector')}
    ${SourceTimeline(src, 'Underlying Sources / Items', 20, false)}
    ${WatchlistBadge(watch)}
  `;
}

function renderSourceDetail(id) {
  const s = (state.data.sources || []).find(x => x.id === id);
  if (!s) return renderEmptyView(`找不到 source：${id}`);
  const rel = (state.data.sources || []).filter(x => x.id !== s.id && ((x.ticker && x.ticker === s.ticker) || (x.company_tags || []).some(t => (s.company_tags || []).includes(t)))).slice(0, 6);
  const fakeSummary = {
    title: s.title,
    one_line_summary: s.summary,
    key_points: [s.summary],
    what_changed: [],
    watchlist_status: s.watchlist_status,
    thesis_status: s.thesis_status,
    conviction: '-',
    risks: [],
    opportunities: [],
    related_entities: [...(s.company_tags || []), ...(s.sector_tags || []), ...(s.market_tags || [])],
    last_updated: s.last_updated,
  };

  app.innerHTML = `
    ${BreadcrumbHeader(['Source', s.title])}
    ${renderTopToolbar()}
    ${SummaryPanel(fakeSummary, 'Source Summary')}
    ${KPIGrid({ source_count: 1, watchlist_count: s.watchlist_status === 'on_watchlist' ? 1 : 0, thesis_changes_count: s.thesis_status !== 'intact' ? 1 : 0, untagged_count: s.is_uncategorized ? 1 : 0 })}
    <section class="panel">
      <h3>Metadata</h3>
      <div class="sub">source_type: ${esc(s.source_type)} · date: ${esc(s.date)} · ticker: ${esc(s.ticker || '-')}</div>
      <div class="chips">
        ${(s.categories || []).map(x => `<span class='chip'>${esc(x)}</span>`).join('')}
        ${(s.company_tags || []).map(x => `<span class='chip'>company:${esc(x)}</span>`).join('')}
        ${(s.sector_tags || []).map(x => `<span class='chip'>sector:${esc(x)}</span>`).join('')}
        ${(s.market_tags || []).map(x => `<span class='chip'>market:${esc(x)}</span>`).join('')}
      </div>
    </section>
    ${SourceTimeline(rel, 'Related Items', 6, false)}
  `;
}

function renderSourcesAll() {
  const rows = searchAndFilterSources(state.data.sources || [], state);
  app.innerHTML = `
    ${BreadcrumbHeader(['Sources'])}
    ${renderTopToolbar()}
    ${SummaryPanel(summaryFromSources('All Sources', rows), 'Sources Summary')}
    ${KPIGrid({ source_count: rows.length, watchlist_count: rows.filter(r => r.watchlist_status === 'on_watchlist').length, thesis_changes_count: rows.filter(r => r.thesis_status !== 'intact').length, untagged_count: rows.filter(r => r.is_uncategorized).length })}
    ${SourceTimeline(rows, 'All Sources', 50, false)}
  `;
}

function summaryFromSources(title, rows) {
  const points = rows.slice(0, 5).map(r => r.summary).filter(Boolean);
  return {
    title,
    one_line_summary: points[0] || '目前資料不足，待補充。',
    key_points: points,
    what_changed: rows.filter(r => r.thesis_status !== 'intact').map(r => `${r.title}: ${r.thesis_status}`).slice(0, 5),
    watchlist_status: rows.some(r => r.watchlist_status === 'on_watchlist') ? 'mixed' : 'off_watchlist',
    thesis_status: rows.some(r => r.thesis_status !== 'intact') ? 'mixed' : 'intact',
    conviction: '-',
    risks: [],
    opportunities: [],
    related_entities: [],
    last_updated: state.data?.stats?.latest_date || '-',
  };
}

function renderEmptyView(msg) {
  app.innerHTML = `${BreadcrumbHeader([])}<section class="panel"><div class="empty">${esc(msg)}</div></section>`;
}

function bindInteractions() {
  const search = document.getElementById('searchInput');
  if (search) {
    search.oninput = (e) => {
      state.query = e.target.value;
      renderByRoute();
    };
  }
  const typeSel = document.getElementById('sourceTypeFilter');
  if (typeSel) {
    typeSel.onchange = (e) => {
      state.sourceType = e.target.value;
      renderByRoute();
    };
  }

  document.querySelectorAll('[data-kind="l1"]').forEach(node => {
    node.onclick = () => {
      const raw = node.getAttribute('data-slug') || '';
      const m = raw.match(/\(([^)]+)\)$/);
      const l1 = m ? m[1] : 'companies';
      navTo(`/category/${l1}`);
    };
  });
  document.querySelectorAll('[data-kind="l2"]').forEach(node => {
    node.onclick = () => {
      const slug = node.getAttribute('data-slug') || '';
      if (routeCache.view === 'category') navTo(`/category/${routeCache.p1}/${encodeURIComponent(slug)}`);
    };
  });
  document.querySelectorAll('[data-kind="sector"]').forEach(node => node.onclick = () => navTo(`/sectors/${node.getAttribute('data-slug')}`));
  document.querySelectorAll('[data-kind="company"]').forEach(node => node.onclick = () => navTo(`/companies/${node.getAttribute('data-slug')}`));
  document.querySelectorAll('[data-source-id]').forEach(node => node.onclick = () => navTo(`/sources/${node.getAttribute('data-source-id')}`));
  document.querySelectorAll('[data-company-ticker]').forEach(node => {
    node.onclick = () => {
      const t = node.getAttribute('data-company-ticker') || '';
      navTo(`/companies/${encodeURIComponent(t.toLowerCase())}`);
    };
  });
}

let routeCache = { view: 'home', p1: '', p2: '' };
function renderByRoute() {
  if (!state.data) return;
  routeCache = parseHash();
  const { view, p1, p2 } = routeCache;
  if (view === 'home') renderHome();
  else if (view === 'category' && p1 && !p2) renderCategory(p1);
  else if (view === 'category' && p1 && p2) {
    // category L2 view reuses filter by l1/l2
    const node = findL1Node(p1);
    const child = (node?.children || []).find(c => c.l2 === decodeURIComponent(p2));
    const ids = child?.source_ids || [];
    const rows = searchAndFilterSources(byIds(state.data.sources || [], ids), state);
    app.innerHTML = `
      ${BreadcrumbHeader([node?.label || p1, decodeURIComponent(p2)])}
      ${renderTopToolbar()}
      ${SummaryPanel(child?.summary, `${decodeURIComponent(p2)} Summary`)}
      ${KPIGrid({ source_count: rows.length, watchlist_count: rows.filter(r => r.watchlist_status === 'on_watchlist').length, thesis_changes_count: rows.filter(r => r.thesis_status !== 'intact').length, untagged_count: rows.filter(r => r.is_uncategorized).length })}
      ${RiskOpportunityPanel(child?.summary || {})}
      ${SourceTimeline(rows, 'Underlying Sources / Items', 20, false)}
    `;
  }
  else if (view === 'sectors' && p1) renderSector(decodeURIComponent(p1));
  else if (view === 'companies' && p1) renderCompany(decodeURIComponent(p1));
  else if (view === 'sources' && p1) renderSourceDetail(decodeURIComponent(p1));
  else if (view === 'sources') renderSourcesAll();
  else renderHome();

  bindInteractions();
}

async function load() {
  try {
    setLoading(true);
    clearError();
    const res = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`讀取失敗：HTTP ${res.status} ${res.statusText}`);
    state.data = await res.json();
    renderByRoute();
  } catch (err) {
    console.error(err);
    showError(`Dashboard 載入失敗：${err.message}`);
    renderEmptyView('載入失敗，請刷新或稍後重試。');
  } finally {
    setLoading(false);
  }
}

el('refreshBtn').addEventListener('click', load);
window.addEventListener('hashchange', renderByRoute);
load();
