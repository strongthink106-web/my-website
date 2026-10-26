'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const state = { user: null, csrf: '', screen: 'dashboard', items: [], editingId: null, modalResource: null, clients: [], projects: [] };
  const screenMeta = {
    dashboard: ['OVERVIEW', 'YOUR BUSINESS AT A GLANCE', 'Overview', 'Keep the moving parts moving.'],
    projects: ['PROJECTS', 'DELIVERY / TRACKING', 'Projects', 'Create, track, and move client work forward.'],
    tasks: ['TASKS', 'DELIVERY / EXECUTION', 'Tasks', 'Give each important next step an owner and due date.'],
    portfolio: ['PORTFOLIO', 'CMS / SELECTED WORK', 'Portfolio', 'Publish work that demonstrates your thinking and craft.'],
    services: ['SERVICES', 'CMS / OFFERING', 'Services', 'Shape your services and make the value easy to understand.'],
    blog: ['JOURNAL', 'CMS / CONTENT MARKETING', 'Journal', 'Manage articles that build useful authority over time.'],
    leads: ['LEADS & CRM', 'RELATIONSHIPS / PIPELINE', 'Leads & CRM', 'Keep inquiries, next steps, and client history in one place.'],
    invoices: ['INVOICES', 'FINANCE / BILLING', 'Invoices', 'Track project billing and payment status.'],
    clients: ['CLIENTS', 'RELATIONSHIPS / ACCOUNTS', 'Clients', 'Keep client access and contact details current.'],
    testimonials: ['TESTIMONIALS', 'CMS / SOCIAL PROOF', 'Testimonials', 'Show the value of a thoughtful partnership.'],
    feedback: ['FEEDBACK', 'CLIENT EXPERIENCE / APPROVALS', 'Feedback', 'Review comments and design approval notes from clients.']
  };
  const schemas = {
    projects: { columns: ['title','client_name','industry','status','progress','deadline','hours_logged'], fields: [
      { key:'title', label:'Project name', required:true }, { key:'client_id', label:'Client account', type:'client', required:true }, { key:'industry', label:'Industry', type:'select', options:['Retail & E-Commerce','Restaurant & Hospitality','Finance & Advisory','Fashion','Branding','Professional Services','General'] }, { key:'status', label:'Status', type:'select', options:['Discovery','Strategy','Design','Development','In review','QA','Ready to launch','Complete','On hold'] }, { key:'progress', label:'Progress %', type:'number', value:10, min:0, max:100 }, { key:'deadline', label:'Deadline', type:'date' }, { key:'budget', label:'Budget', type:'number', value:0, min:0 }, { key:'hours_logged', label:'Hours logged', type:'number', value:0, min:0 }, { key:'description', label:'Project brief', type:'textarea', wide:true }, { key:'contract_url', label:'Contract URL', wide:true }
    ]},
    tasks: { columns:['title','project_title','status','due_date','assigned_to'], fields:[
      { key:'title', label:'Task name', required:true }, { key:'project_id', label:'Project', type:'project', required:true }, { key:'status', label:'Status', type:'select', options:['To do','In progress','In review','Done','Blocked'] }, { key:'due_date', label:'Due date', type:'date' }, { key:'assigned_to', label:'Assigned to' }
    ]},
    portfolio: { columns:['title','category','service','featured'], fields:[
      { key:'title', label:'Project name', required:true }, { key:'category', label:'Industry', type:'select', options:['Retail','Restaurant','Finance','Fashion','Branding','Professional Services','Other'], required:true }, { key:'service', label:'Service type', type:'select', options:['Web Design','E-Commerce','Branding','Web Design + Branding','Digital Strategy','Financial UX','Other'] }, { key:'summary', label:'Short summary', type:'textarea', wide:true }, { key:'challenge', label:'The challenge', type:'textarea', wide:true }, { key:'solution', label:'Our solution', type:'textarea', wide:true }, { key:'results', label:'Results / outcome', type:'textarea', wide:true }, { key:'client_testimonial', label:'Client testimonial', type:'textarea', wide:true }, { key:'live_url', label:'Live project link', wide:true }, { key:'image', label:'Image path or URL', wide:true, hint:'Use a path under /assets/ or a secure https:// image URL.' }, { key:'featured', label:'Feature this project (1 = yes)', type:'select', options:['1','0'], value:'0' }
    ]},
    services: { columns:['title','category','price_label','sort_order'], fields:[
      { key:'title', label:'Service title', required:true }, { key:'category', label:'Category' }, { key:'description', label:'Description', type:'textarea', wide:true }, { key:'price_label', label:'Starting price / pricing label' }, { key:'features', label:'Features (one per line)', type:'textarea', wide:true }, { key:'icon', label:'Icon character', value:'✳' }, { key:'sort_order', label:'Display order', type:'number', value:0 }
    ]},
    blog: { columns:['title','category','author','published','created_at'], fields:[
      { key:'title', label:'Article title', required:true }, { key:'slug', label:'URL slug (unique)', required:true }, { key:'category', label:'Category', type:'select', options:['Web Strategy','Web Design Trends','E-Commerce','Hospitality','Branding','Finance UX','Insights'] }, { key:'excerpt', label:'Short excerpt', type:'textarea', wide:true }, { key:'content', label:'Article content', type:'textarea', wide:true }, { key:'author', label:'Author', value:'Strong Think Team' }, { key:'published', label:'Published (1 = yes)', type:'select', options:['1','0'], value:'1' }
    ]},
    leads: { columns:['name','email','company','project_type','industry','budget','status','created_at'], fields:[
      { key:'name', label:'Contact name', required:true }, { key:'email', label:'Email', required:true }, { key:'company', label:'Company' }, { key:'project_type', label:'Project type' }, { key:'industry', label:'Industry' }, { key:'budget', label:'Budget range' }, { key:'status', label:'Pipeline status', type:'select', options:['New','Contacted','Discovery booked','Proposal sent','Won','Lost','Archived'] }, { key:'details', label:'Project details', type:'textarea', wide:true }, { key:'source', label:'Lead source', value:'Website' }
    ]},
    invoices: { columns:['invoice_number','client_name','project_title','amount','currency','due_date','status'], fields:[
      { key:'invoice_number', label:'Invoice number', required:true }, { key:'client_id', label:'Client account', type:'client', required:true }, { key:'project_id', label:'Project (optional)', type:'project' }, { key:'description', label:'Description', type:'textarea', wide:true }, { key:'amount', label:'Amount', type:'number', min:0, required:true }, { key:'currency', label:'Currency', type:'select', options:['USD','BDT','GBP','EUR','CAD','AUD'], value:'USD' }, { key:'due_date', label:'Due date', type:'date' }, { key:'status', label:'Status', type:'select', options:['Draft','Sent','Paid','Overdue','Void'], value:'Draft' }
    ]},
    testimonials: { columns:['client_name','company','quote','rating'], fields:[
      { key:'client_name', label:'Client name', required:true }, { key:'company', label:'Company / role' }, { key:'quote', label:'Testimonial', type:'textarea', wide:true, required:true }, { key:'rating', label:'Rating (1–5)', type:'number', value:5, min:1, max:5 }
    ]},
    feedback: { columns:['project_title','client_name','feedback_type','message','status','created_at'], fields:[{ key:'status', label:'Feedback status', type:'select', options:['Open','In progress','Resolved','Approved','Revision requested'] }] }
  };
  const titleMap = { title:'Project / article', client_name:'Client', client_email:'Client email', project_title:'Project', industry:'Industry', status:'Status', progress:'Progress', deadline:'Deadline', hours_logged:'Hours', category:'Industry / category', service:'Service', featured:'Featured', due_date:'Due date', assigned_to:'Assignee', price_label:'Pricing', sort_order:'Order', author:'Author', published:'Published', name:'Name', email:'Email', company:'Company', project_type:'Project type', budget:'Budget', created_at:'Created', invoice_number:'Invoice #', amount:'Amount', currency:'Currency', quote:'Quote', rating:'Rating', feedback_type:'Type', message:'Client note', details:'Project details' };
  const escText = value => String(value ?? '');
  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (!['GET','HEAD','OPTIONS'].includes((options.method || 'GET').toUpperCase()) && state.csrf) headers.set('x-csrf-token', state.csrf);
    const response = await fetch(url, { ...options, headers, credentials:'same-origin' });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }
  async function init() {
    try { const csrf = await fetch('/api/csrf').then(r => r.json()); state.csrf = csrf.csrfToken || ''; } catch {}
    try { const config = await fetch('/api/public-config').then(r => r.json()); if (config.demoCredentials) { const creds=config.demoCredentials; const email=$('#adminLoginForm [name=email]'); const password=$('#adminLoginForm [name=password]'); if(email)email.value=creds.adminEmail; if(password)password.value=creds.adminPassword; const note=$('.demo-note'); if(note){note.hidden=false; $('[data-demo-email]',note).textContent=creds.adminEmail; $('[data-demo-password]',note).textContent=creds.adminPassword;} } } catch {}
    try {
      const me = await request('/api/me');
      if (me.user?.role === 'admin') { state.user = me.user; showWorkspace(); await loadScreen('dashboard'); return; }
      if (me.user?.role === 'client') { location.href = '/portal'; return; }
    } catch {}
    $('#adminLoginShell').hidden = false;
  }
  function showWorkspace() {
    $('#adminLoginShell').hidden = true; $('#adminWorkspace').hidden = false;
    $('#adminName').textContent = state.user.name;
    $('#adminAvatar').textContent = state.user.name.split(/\s+/).map(v=>v[0]).join('').slice(0,2).toUpperCase();
  }
  function toast(message) {
    const el = $('#adminToast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(()=>el.classList.remove('show'),3200);
  }
  $('#adminLoginForm')?.addEventListener('submit', async event => {
    event.preventDefault(); const button = $('button[type="submit"]', event.currentTarget); const feedback = $('#adminLoginFeedback'); const before=button.textContent;
    button.disabled = true; button.textContent = 'Signing in…'; feedback.textContent='';
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const data = await request('/api/auth/login', { method:'POST', body:JSON.stringify(body) });
      if (data.user.role !== 'admin') { await request('/api/auth/logout', { method:'POST' }); throw new Error('This account does not have admin access. Use the client portal instead.'); }
      state.user = data.user; state.csrf = data.csrfToken || state.csrf; showWorkspace(); await loadScreen('dashboard');
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; button.textContent = before; }
  });
  $('#adminLogout')?.addEventListener('click', async () => { try { await request('/api/auth/logout',{method:'POST'}); location.reload(); } catch(e){ toast(e.message); } });
  $('#adminNav')?.addEventListener('click', event => { const button = event.target.closest('[data-screen]'); if (!button) return; loadScreen(button.dataset.screen); });
  $('#createItemButton')?.addEventListener('click', () => openModal(state.screen));

  async function loadScreen(screen) {
    if (!screenMeta[screen]) screen='dashboard';
    state.screen = screen;
    $$('.ws-nav-link').forEach(button => button.classList.toggle('active', button.dataset.screen === screen));
    const meta = screenMeta[screen]; $('#screenKicker').textContent=meta[0]; $('#screenOverline').textContent=meta[1]; $('#screenTitle').textContent=meta[2]; $('#screenTitle').append(document.createElement('span')); $('#screenTitle').lastChild.textContent='.'; $('#screenDescription').textContent=meta[3];
    $('#createItemButton').hidden = !['projects','tasks','portfolio','services','blog','leads','invoices','clients','testimonials'].includes(screen);
    $('#createItemButton').textContent = screen==='clients' ? '+ New client' : screen==='leads' ? '+ Add lead' : '+ New item';
    const container = $('#screenContent'); container.innerHTML = '<div class="loading-skeleton"></div>';
    try {
      if (screen==='dashboard') { const data=await request('/api/admin/summary'); renderDashboard(data); }
      else if (screen==='clients') { const data=await request('/api/admin/clients'); state.items=data.items||[]; renderClients(state.items); }
      else { const data=await request(`/api/admin/${screen}`); state.items=data.items||[]; renderResource(screen,state.items); }
    } catch (error) { container.replaceChildren(); const box=document.createElement('div'); box.className='ws-panel table-empty'; box.textContent=error.message; container.append(box); }
  }
  function element(tag, className, value) { const el=document.createElement(tag); if(className)el.className=className; if(value!==undefined)el.textContent=value; return el; }
  function renderDashboard(data) {
    const root=$('#screenContent'); root.replaceChildren(); const counts=data.counts||{};
    const stats=element('div','stat-grid');
    const cards=[['Active projects',counts.projects||0,'↗','Projects in the workspace'],['Client accounts',counts.clients||0,'◎','Secure client access'],['New inquiries',counts.leads||0,'↗','Leads awaiting first contact'],['Portfolio pieces',counts.portfolio||0,'◧','Published project records']];
    cards.forEach(([label,num,icon,note])=>{const card=element('div','stat-card');const top=element('div','stat-top',label);top.append(element('span','stat-icon',icon));card.append(top,element('div','stat-number',num),element('div','stat-note',note));stats.append(card);});root.append(stats);
    const grid=element('div','dashboard-grid');
    const projectsPanel=element('section','ws-panel');const ph=element('div','panel-header');const phleft=element('div');phleft.append(element('h2','','Project pulse'),element('p','','Progress across the latest client work.'));const viewProjects=element('button','panel-link','View all ↗');viewProjects.addEventListener('click',()=>loadScreen('projects'));ph.append(phleft,viewProjects);projectsPanel.append(ph);
    const pb=element('div','panel-body');(data.projects||[]).forEach(p=>{const row=element('div','project-preview');const top=element('div','project-preview-top');const title=element('div');title.append(element('h3','',p.title),element('p','',`${p.client_name||'Unassigned client'} · ${p.industry||'General'}`));top.append(title,statusPill(p.status));const line=element('div','project-progress-line');const fill=element('i');fill.style.width=`${Math.min(100,Math.max(0,Number(p.progress)||0))}%`;line.append(fill);const bottom=element('div','project-preview-bottom');bottom.append(element('span','',`${p.progress||0}% complete`),element('span','',p.deadline?`Due ${p.deadline}`:'No deadline set'));row.append(top,line,bottom);pb.append(row);});if(!(data.projects||[]).length)pb.append(element('div','table-empty','No projects yet. Create your first project to get started.'));projectsPanel.append(pb);
    const leadsPanel=element('section','ws-panel');const lh=element('div','panel-header');const lhl=element('div');lhl.append(element('h2','','Latest inquiries'),element('p','','New conversations from your website.'));const viewLeads=element('button','panel-link','Open CRM ↗');viewLeads.addEventListener('click',()=>loadScreen('leads'));lh.append(lhl,viewLeads);leadsPanel.append(lh);const lb=element('div','panel-body');(data.recentLeads||[]).forEach(lead=>{const row=element('div','lead-row');const left=element('div');left.append(element('span','lead-name',lead.name),element('span','lead-company',lead.company||lead.project_type||'Project inquiry'),element('span','lead-email',lead.email));row.append(left,statusPill(lead.status));lb.append(row);});if(!(data.recentLeads||[]).length)lb.append(element('div','table-empty','No inquiries yet.'));leadsPanel.append(lb);grid.append(projectsPanel,leadsPanel);root.append(grid);
    const second=element('section','ws-panel');second.style.marginTop='16px';const hh=element('div','panel-header');const hhl=element('div');hhl.append(element('h2','','Recent client feedback'),element('p','','Approval notes and revision requests from the portal.'));const feedbackBtn=element('button','panel-link','Review feedback ↗');feedbackBtn.addEventListener('click',()=>loadScreen('feedback'));hh.append(hhl,feedbackBtn);second.append(hh);const fb=element('div','panel-body');(data.feedback||[]).forEach(item=>{const row=element('div','project-preview');const top=element('div','project-preview-top');top.append(element('h3','',`${item.project_title} · ${item.client_name}`),statusPill(item.status));row.append(top,element('p','',`${item.feedback_type}: ${item.message}`));fb.append(row);});if(!(data.feedback||[]).length)fb.append(element('div','table-empty','No client feedback submitted yet.'));second.append(fb);root.append(second);
    const finance=element('div','stat-grid');finance.style.marginTop='16px';[['Outstanding invoices',formatMoney(data.openInvoices),'Not marked paid'],['Recorded revenue',formatMoney(data.paidRevenue),'Invoices marked as paid']].forEach(([label,num,note])=>{const c=element('div','stat-card');c.append(element('div','stat-top',label),element('div','stat-number',num),element('div','stat-note',note));finance.append(c);});root.append(finance);
  }
  function statusPill(value) {const status=String(value||'Unknown');const el=element('span','status-pill',status);const v=status.toLowerCase();if(['paid','done','complete','won','approved','resolved'].some(x=>v.includes(x)))el.classList.add('green');else if(['review','sent','progress','contacted','discovery'].some(x=>v.includes(x)))el.classList.add('orange');else if(['lost','overdue','blocked','revision'].some(x=>v.includes(x)))el.classList.add('red');else if(['new','to do','draft','open','unknown','archived'].some(x=>v===x))el.classList.add('gray');return el;}
  function formatMoney(amount,currency='USD'){const n=Number(amount)||0;return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0}).format(n);}
  function displayValue(key,value,item={}) {
    if(value===null||value===undefined||value==='')return '—';
    if(key==='amount'||key==='budget')return formatMoney(value,item.currency||'USD');
    if(key==='progress')return `${value}%`;
    if(key==='featured'||key==='published')return Number(value)?'Yes':'No';
    if(key==='created_at')return String(value).slice(0,10);
    if(key==='message'||key==='quote'||key==='details')return String(value).length>90?`${String(value).slice(0,90)}…`:String(value);
    if(key==='hours_logged')return `${value}h`;
    return String(value);
  }
  function renderResource(resource,items) {
    const root=$('#screenContent');root.replaceChildren();const config=schemas[resource];if(!config){root.append(element('div','ws-panel table-empty','This resource is not configured.'));return;}
    const panel=element('section','ws-panel');const toolbar=element('div','table-toolbar');const note=element('p','',`${items.length} record${items.length===1?'':'s'} · Use Edit to update a record.`);const search=element('input','table-search');search.placeholder='Search records…';search.setAttribute('aria-label','Search records');toolbar.append(note,search);panel.append(toolbar);
    const wrap=element('div','data-table-wrap');const table=element('table','ws-table');const thead=element('thead');const trh=element('tr');config.columns.forEach(key=>trh.append(element('th','',titleMap[key]||key.replaceAll('_',' '))));trh.append(element('th','','Actions'));thead.append(trh);table.append(thead);const tbody=element('tbody');table.append(tbody);wrap.append(table);panel.append(wrap);root.append(panel);
    function draw(query='') {tbody.replaceChildren();const filtered=items.filter(item=>JSON.stringify(item).toLowerCase().includes(query.toLowerCase()));if(!filtered.length){const row=element('tr');const td=element('td','table-empty',query?'No matching records.':'No records yet.');td.colSpan=config.columns.length+1;row.append(td);tbody.append(row);return;}
      filtered.forEach(item=>{const row=element('tr');config.columns.forEach(key=>{const td=element('td');let val=item[key];if(key==='progress'){td.className='progress-cell';const line=element('div','project-progress-line');const fill=element('i');fill.style.width=`${Math.min(100,Number(val)||0)}%`;line.append(fill);td.append(line,element('small','',`${val||0}% complete`));}else if(key==='status'||key==='published'||key==='featured'){td.append(statusPill(key==='published'||key==='featured'?(Number(val)?'Yes':'No'):val));}else if(key==='title'||key==='name'||key==='client_name'||key==='invoice_number'||key==='client_name'||key==='project_title'||key==='client_name'){td.append(element('span','cell-title',displayValue(key,val,item)));}else{td.textContent=displayValue(key,val,item);}row.append(td);});
        const actions=element('td');const group=element('div','table-actions');
        {const edit=element('button','table-action','Edit');edit.addEventListener('click',()=>openModal(resource,item));group.append(edit);}
        if(resource==='projects'){const hour=element('button','table-action','+ Hours');hour.addEventListener('click',()=>logHours(item));group.append(hour);const upload=element('button','table-action','Upload');upload.addEventListener('click',()=>uploadMockup(item));group.append(upload);}
        if(resource==='leads'){const history=element('button','table-action','History');history.addEventListener('click',()=>showInteractions(item));group.append(history);}
        if(resource==='invoices' && item.status!=='Paid' && item.status!=='Void'){const paid=element('button','table-action','Mark paid');paid.addEventListener('click',()=>markPaid(item));group.append(paid);}
        if(['tasks','portfolio','services','blog','testimonials','feedback'].includes(resource)){const del=element('button','table-action danger','Delete');del.addEventListener('click',()=>deleteItem(resource,item));group.append(del);}
        if(resource==='projects'&&item.contract_url){const contract=element('a','table-action','Contract');contract.href=item.contract_url;contract.target='_blank';contract.rel='noopener noreferrer';group.append(contract);}
        actions.append(group);row.append(actions);tbody.append(row);});
    }
    draw();search.addEventListener('input',()=>draw(search.value));
  }
  function renderClients(items){
    const root=$('#screenContent');root.replaceChildren();const panel=element('section','ws-panel');const toolbar=element('div','table-toolbar');toolbar.append(element('p','',`${items.length} client account${items.length===1?'':'s'}`));const search=element('input','table-search');search.placeholder='Search name, email, company…';toolbar.append(search);panel.append(toolbar);const wrap=element('div','data-table-wrap');const table=element('table','ws-table');const thead=element('thead');const tr=element('tr');['Client','Email','Company','Created','Actions'].forEach(v=>tr.append(element('th','',v)));thead.append(tr);table.append(thead);const tbody=element('tbody');table.append(tbody);wrap.append(table);panel.append(wrap);root.append(panel);
    function draw(query=''){tbody.replaceChildren();const rows=items.filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase()));if(!rows.length){const r=element('tr');const c=element('td','table-empty','No clients found.');c.colSpan=5;r.append(c);tbody.append(r);return;}rows.forEach(item=>{const r=element('tr');[item.name,item.email,item.company||'—',String(item.created_at||'').slice(0,10)||'—'].forEach((value,i)=>r.append(element('td',i===0?'cell-title':'',value)));const td=element('td');const edit=element('button','table-action','Edit');edit.addEventListener('click',()=>openModal('clients',item));td.append(edit);r.append(td);tbody.append(r);});}
    draw();search.addEventListener('input',()=>draw(search.value));
  }
  async function openModal(resource,item=null){
    state.modalResource=resource;state.editingId=item?.id??null;$('#itemModal').hidden=false;$('#modalFeedback').textContent='';$('#itemFormFields').replaceChildren();$('#modalTitle').firstChild?null:null;$('#modalTitle').textContent=item?'Edit item':'Create item';$('#modalTitle').append(element('span','','.'));$('#saveItemButton').textContent=item?'Save changes ↗':'Create item ↗';
    if(['projects','tasks','invoices'].includes(resource)){try{const [c,p]=await Promise.all([request('/api/admin/clients'),request('/api/admin/projects')]);state.clients=c.items||[];state.projects=p.items||[];}catch{}}
    const fields=resource==='clients'?[{key:'name',label:'Client name',required:true},{key:'email',label:'Email address',required:true},{key:'company',label:'Company / brand' },...(item?[]:[{key:'password',label:'Temporary password (min 12 characters)',required:true,hint:'Share this securely with the client; ask them to change it in your deployment workflow.'}])]:schemas[resource]?.fields||[];
    fields.forEach(field=>{
      const wrap=element('div',`editor-field${field.wide?' wide':''}`);const label=element('label','',field.label);if(field.required){const star=element('span','',' *');star.style.color='#b64b55';label.append(star);}wrap.append(label);
      let input;
      if(field.type==='textarea'){input=element('textarea');input.rows=4;}
      else if(field.type==='select'||field.type==='client'||field.type==='project'){
        input=element('select');const blank=element('option','','Choose…');blank.value='';input.append(blank);
        let options=field.options||[];
        if(field.type==='client')options=state.clients.map(c=>({value:String(c.id),label:`${c.name} — ${c.company||c.email}`}));
        if(field.type==='project')options=state.projects.map(p=>({value:String(p.id),label:p.title}));
        options.forEach(opt=>{const option=element('option','',typeof opt==='object'?opt.label:opt);option.value=typeof opt==='object'?opt.value:opt;input.append(option);});
      } else {input=element('input');input.type=field.type==='number'?'number':field.type==='date'?'date':'text';if(field.min!==undefined)input.min=field.min;if(field.max!==undefined)input.max=field.max;if(field.key==='email')input.type='email';if(field.key==='password')input.type='password';}
      input.name=field.key;if(field.required)input.required=true;if(field.value!==undefined)input.value=field.value;if(item&&item[field.key]!==undefined&&item[field.key]!==null)input.value=item[field.key];if(field.key==='client_id'||field.key==='project_id')input.value=item?.[field.key]??'';
      if(field.key==='password')input.autocomplete='new-password';wrap.append(input);if(field.hint)wrap.append(element('small','editor-hint',field.hint));$('#itemFormFields').append(wrap);
    });
    $('#itemModal').scrollTop=0;
  }
  function closeModal(){$('#itemModal').hidden=true;$('#itemForm').reset();state.editingId=null;state.modalResource=null;}
  $('#closeModal')?.addEventListener('click',closeModal);$('#cancelModal')?.addEventListener('click',closeModal);$('#itemModal')?.addEventListener('click',event=>{if(event.target.id==='itemModal')closeModal();});
  $('#itemForm')?.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;const button=$('#saveItemButton');const before=button.textContent;button.disabled=true;button.textContent='Saving…';$('#modalFeedback').textContent='';
    const body=Object.fromEntries(new FormData(form).entries());const resource=state.modalResource;
    if(body.client_id==='')delete body.client_id;if(body.project_id==='')delete body.project_id;
    for(const key of ['progress','budget','hours_logged','featured','sort_order','published','rating','amount','client_id','project_id'])if(body[key]!==undefined&&body[key]!=='')body[key]=Number(body[key]);
    try{
      if(resource==='clients'){
        if(state.editingId){await request(`/api/admin/clients/${state.editingId}`,{method:'PUT',body:JSON.stringify(body)});}
        else await request('/api/admin/clients',{method:'POST',body:JSON.stringify(body)});
      } else {
        const url=state.editingId?`/api/admin/${resource}/${state.editingId}`:`/api/admin/${resource}`;
        await request(url,{method:state.editingId?'PUT':'POST',body:JSON.stringify(body)});
      }
      const wasEditing=Boolean(state.editingId);closeModal();toast(wasEditing?'Changes saved.':'New item created.');await loadScreen(resource);
    }catch(error){$('#modalFeedback').textContent=error.message;}
    finally{button.disabled=false;button.textContent=before;}
  });
  async function deleteItem(resource,item){if(!confirm(`Delete “${item.title||item.client_name||item.message||'this item'}”? This action cannot be undone.`))return;try{await request(`/api/admin/${resource}/${item.id}`,{method:'DELETE'});toast('Item deleted.');await loadScreen(resource);}catch(error){toast(error.message);}}
  async function markPaid(item){if(!confirm(`Mark invoice ${item.invoice_number} as paid?`))return;try{await request(`/api/admin/invoices/${item.id}/mark-paid`,{method:'POST',body:'{}'});toast('Invoice marked as paid.');await loadScreen('invoices');}catch(error){toast(error.message);}}
  async function logHours(project){const hours=prompt(`Hours to log for “${project.title}” (max 24):`);if(hours===null)return;const note=prompt('Short note for the activity log:')||'';try{await request(`/api/admin/projects/${project.id}/hours`,{method:'POST',body:JSON.stringify({hours:Number(hours),note})});toast('Project hours recorded.');await loadScreen('projects');}catch(error){toast(error.message);}}
  async function uploadMockup(project){const input=element('input');input.type='file';input.accept='.jpg,.jpeg,.png,.webp,.pdf';input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;const data=new FormData();data.append('file',file);try{await request(`/api/admin/projects/${project.id}/uploads`,{method:'POST',body:data});toast('Project file uploaded and shared with the client.');}catch(error){toast(error.message);}});input.click();}
  async function showInteractions(lead){try{const data=await request(`/api/admin/leads/${lead.id}/interactions`);const previous=(data.items||[]).map(x=>`${x.created_at}: ${x.note}`).join('\n\n')||'No interaction notes yet.';const note=prompt(`CRM history for ${lead.name}:\n\n${previous}\n\nAdd a new note (leave blank to cancel):`,'');if(!note?.trim())return;await request(`/api/admin/leads/${lead.id}/interactions`,{method:'POST',body:JSON.stringify({note})});toast('Interaction note saved.');}catch(error){toast(error.message);}}
  init();
})();
