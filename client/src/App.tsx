import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type Status = 'NEW' | 'CONTACTED' | 'INTERESTED' | 'CLOSED' | 'LOST';
type Page = 'dashboard' | 'leads' | 'conversations' | 'analytics' | 'simulator' | 'settings';
type Lead = { id:string; name:string; initials:string; email:string; phone:string; company:string; status:Status; source:string; updated:string; accent:string };

const nav:{id:Page;label:string;icon:string}[]=[{id:'dashboard',label:'Dashboard',icon:'⌂'},{id:'leads',label:'Leads',icon:'◎'},{id:'conversations',label:'Conversaciones',icon:'◫'},{id:'analytics',label:'Analítica',icon:'↗'},{id:'simulator',label:'Simulador IA',icon:'✦'}];
const labels:Record<Status,string>={NEW:'Nuevo',CONTACTED:'Contactado',INTERESTED:'Interesado',CLOSED:'Cerrado',LOST:'Perdido'};
const StatusPill=({status}:{status:Status})=><span className={`status ${status.toLowerCase()}`}><i/>{labels[status]}</span>;

type ApiLead={id:string;name:string;email:string;company?:string;phone?:string;source:string;status:'new'|'contacted'|'qualified'|'won'|'closed'|'lost';updatedAt:string};
const apiStatuses:Record<ApiLead['status'],Status>={new:'NEW',contacted:'CONTACTED',qualified:'INTERESTED',won:'CLOSED',closed:'CLOSED',lost:'LOST'};
export function App(){
  const [leads,setLeads]=useState<Lead[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    async function load(){try{
      const response=await fetch('/api/leads',{signal:controller.signal});
      if(!response.ok) throw new Error('No se pudo consultar la API');
      const result:{data:ApiLead[]}=await response.json();
      if(!Array.isArray(result.data)) throw new Error('Respuesta inválida');
      const items=result.data.map(lead=>({...lead,status:apiStatuses[lead.status],company:lead.company||'Sin empresa',phone:lead.phone||'Sin teléfono',initials:lead.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase(),updated:new Date(lead.updatedAt).toLocaleString('es-CO'),accent:'#d7edff'}));
      if(!controller.signal.aborted)setLeads(items);
    }catch{if(!controller.signal.aborted)setError('No se pudieron cargar los leads. Comprueba que la API y PostgreSQL estén disponibles.');}
    finally{if(!controller.signal.aborted)setLoading(false)}}
    void load();return ()=>controller.abort();
  },[attempt]);
  const [page,setPage]=useState<Page>('dashboard'),[selected,setSelected]=useState<Lead|null>(null),[query,setQuery]=useState(''),[filter,setFilter]=useState<'ALL'|Status>('ALL'),[toast,setToast]=useState('');
  const [creating,setCreating]=useState(false);
  const [simMessages,setSimMessages]=useState([{sender:'ai',text:'¡Hola! Soy tu asistente comercial. Cuéntame, ¿qué te gustaría automatizar?'}]),[analyzed,setAnalyzed]=useState(false);
  const visible=useMemo(()=>leads.filter(l=>`${l.name} ${l.company} ${l.email}`.toLowerCase().includes(query.toLowerCase())&&(filter==='ALL'||l.status===filter)),[leads,query,filter]);
  const go=(next:Page)=>{setPage(next);setSelected(null)}; const flash=(m:string)=>{setToast(m);window.setTimeout(()=>setToast(''),2400)};
  const openCreate=()=>setCreating(true);
  const leadCreated=()=>{setCreating(false);go('leads');setQuery('');setFilter('ALL');setAttempt(value=>value+1);flash('Lead creado correctamente')};
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={()=>go('dashboard')}><span>A</span>AI Lead <b>CRM</b></button><p className="nav-label">ESPACIO DE TRABAJO</p><nav>{nav.map(n=><button key={n.id} onClick={()=>go(n.id)} className={page===n.id?'active':''}><span>{n.icon}</span>{n.label}{n.id==='conversations'&&<em>8</em>}</button>)}</nav><div className="sidebar-bottom"><button onClick={()=>go('settings')}><span>⚙</span>Ajustes</button><div className="profile"><span className="avatar">JM</span><div><strong>José Martínez</strong><small>Administrador</small></div><button>•••</button></div></div></aside>
  <main className="workspace"><header className="topbar"><button className="mobile-brand">A</button><div className="global-search"><span>⌕</span><input aria-label="Buscar" placeholder="Buscar leads, empresas..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="icon-button">♢<i/></button><button className="primary" onClick={openCreate}>＋ Nuevo lead</button></header>
  {(page==='dashboard'||page==='leads')&&loading?<div className="page" role="status">Cargando leads…</div>:(page==='dashboard'||page==='leads')&&error?<div className="page" role="alert"><p>{error}</p><button className="primary" onClick={()=>setAttempt(value=>value+1)}>Reintentar</button></div>:selected?<LeadDetail key={selected.id} lead={selected} back={()=>setSelected(null)} flash={flash} onUpdated={updated=>{setLeads(items=>items.map(item=>item.id===updated.id?updated:item));setSelected(current=>current?.id===updated.id?updated:current)}}/>:page==='dashboard'?<Dashboard leads={leads} onLead={setSelected} onAll={()=>go('leads')}/>:page==='leads'?<LeadsPage leads={visible} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onLead={setSelected} onCreate={openCreate}/>:page==='simulator'?<Simulator messages={simMessages} setMessages={setSimMessages} analyzed={analyzed} setAnalyzed={setAnalyzed}/>:<Placeholder page={page}/>}</main>{creating&&<CreateLeadForm onClose={()=>setCreating(false)} onCreated={leadCreated}/>}{toast&&<div className="toast">✓ {toast}</div>}</div>
}

function CreateLeadForm({onClose,onCreated}:{onClose:()=>void;onCreated:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),submitting=useRef(false);
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const element=dialog.current;element?.showModal();return ()=>element?.close()},[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(submitting.current)return;
    const fields=new FormData(event.currentTarget);
    const name=String(fields.get('name')||'').trim();
    const email=String(fields.get('email')||'').trim().toLowerCase();
    if(!name){setError('Escribe el nombre del lead.');return}
    submitting.current=true;setSaving(true);setError('');
    try{
      const response=await fetch('/api/leads',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,email,company:String(fields.get('company')||'').trim(),phone:String(fields.get('phone')||'').trim(),source:String(fields.get('source')||'').trim()||'manual'})
      });
      if(!response.ok){
        setError(response.status===409?'Ya existe un lead con este correo electrónico.':response.status===400?'Revisa los datos del formulario e inténtalo de nuevo.':'No se pudo crear el lead. Inténtalo de nuevo.');
        return;
      }
      onCreated();
    }catch{setError('No se pudo conectar con la API. Comprueba la conexión e inténtalo de nuevo.')}
    finally{submitting.current=false;setSaving(false)}
  }
  return <dialog ref={dialog} className="create-lead-dialog" aria-labelledby="create-lead-title" onCancel={event=>{event.preventDefault();if(!submitting.current)onClose()}}>
    <form onSubmit={submit} aria-busy={saving}>
      <h2 id="create-lead-title">Nuevo lead</h2><p>Agrega un contacto comercial.</p>
      <fieldset disabled={saving}>
        <label htmlFor="lead-name">Nombre *</label><input id="lead-name" name="name" required maxLength={120} autoComplete="name" autoFocus/>
        <label htmlFor="lead-email">Correo electrónico *</label><input id="lead-email" name="email" type="email" required maxLength={254} autoComplete="email"/>
        <label htmlFor="lead-company">Empresa</label><input id="lead-company" name="company" maxLength={160} autoComplete="organization"/>
        <label htmlFor="lead-phone">Teléfono</label><input id="lead-phone" name="phone" type="tel" maxLength={40} autoComplete="tel"/>
        <label htmlFor="lead-source">Origen</label><input id="lead-source" name="source" maxLength={80} defaultValue="manual"/>
      </fieldset>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving?'Guardando…':'Crear lead'}</button></div>
    </form>
  </dialog>
}

function Dashboard({leads,onLead,onAll}:{leads:Lead[];onLead:(l:Lead)=>void;onAll:()=>void}){
  const states:Status[]=['NEW','CONTACTED','INTERESTED','CLOSED','LOST'];
  const count=(status:Status)=>leads.filter(lead=>lead.status===status).length;
  const maximum=Math.max(1,...states.map(count));
  return <div className="page"><Heading eyebrow="RESUMEN COMERCIAL" title="Tus leads" subtitle="Datos actuales de tus contactos comerciales."/><section className="metrics"><Metric icon="◎" tone="blue" value={String(leads.length)} label="Total leads"/><Metric icon="↗" tone="amber" value={String(count('INTERESTED'))} label="Interesados"/><Metric icon="✓" tone="green" value={String(count('CLOSED'))} label="Cerrados"/><Metric icon="◈" tone="violet" value={(leads.length?count('CLOSED')/leads.length*100:0).toFixed(1)+'%'} label="Conversión"/></section><section className="panel"><PanelTitle title="Leads por estado" sub="Todos los contactos"/><div className="bars">{states.map(status=><div className="bar-row" key={status}><span>{labels[status]}</span><div><i style={{width:count(status)/maximum*100+'%',background:'#4774e7'}}/></div><b>{count(status)}</b></div>)}</div></section><section className="panel recent"><PanelTitle title="Leads recientes" sub="Contactos creados más recientemente" action={onAll}/>{leads.length?<LeadTable leads={leads.slice(0,4)} onLead={onLead}/>:<div className="empty"><h3>Aún no hay leads</h3><p>Los contactos guardados en PostgreSQL aparecerán aquí.</p></div>}</section></div>
}
function Heading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action?:React.ReactNode}){return <div className="page-heading"><div><p>{eyebrow}</p><h1>{title}</h1><span>{subtitle}</span></div>{action}</div>}
function PanelTitle({title,sub,action}:{title:string;sub:string;action?:()=>void}){return <div className="panel-title"><div><h2>{title}</h2><p>{sub}</p></div>{action?<button onClick={action}>Ver todo →</button>:<button>•••</button>}</div>}
function Metric({icon,tone,value,label,change}:{icon:string;tone:string;value:string;label:string;change?:string}){return <article className="metric"><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong>{change&&<small><b>↗ {change}</b> vs. periodo anterior</small>}</div></article>}
function Activity({avatar,title,text,time}:{avatar:string;title:string;text:string;time:string}){return <div className="activity"><span className="avatar">{avatar}</span><div><strong>{title}</strong><p>{text}</p></div><small>{time}</small><i/></div>}

function LeadsPage({leads,query,setQuery,filter,setFilter,onLead,onCreate}:{leads:Lead[];query:string;setQuery:(s:string)=>void;filter:'ALL'|Status;setFilter:(s:'ALL'|Status)=>void;onLead:(l:Lead)=>void;onCreate:()=>void}){return <div className="page"><Heading eyebrow="GESTIÓN COMERCIAL" title="Leads" subtitle="Organiza contactos y prioriza las mejores oportunidades." action={<button className="primary" onClick={onCreate}>＋ Nuevo lead</button>}/><section className="panel leads-panel"><div className="lead-tools"><div className="search"><span>⌕</span><input placeholder="Buscar por nombre, empresa o email" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="filters">{(['ALL','NEW','CONTACTED','INTERESTED','CLOSED','LOST'] as const).map(s=><button key={s} className={filter===s?'selected':''} onClick={()=>setFilter(s)}>{s==='ALL'?'Todos':labels[s]}</button>)}</div></div>{leads.length?<LeadTable leads={leads} onLead={onLead}/>:<div className="empty"><span>⌕</span><h3>No encontramos leads</h3><p>Prueba con otro término o cambia el filtro.</p></div>}</section></div>}
function LeadTable({leads,onLead}:{leads:Lead[];onLead:(l:Lead)=>void}){return <div className="table-wrap"><table><thead><tr><th>LEAD</th><th>EMPRESA</th><th>ESTADO</th><th>ORIGEN</th><th>ÚLTIMA ACTIVIDAD</th><th/></tr></thead><tbody>{leads.map(l=><tr key={l.id} onClick={()=>onLead(l)}><td><span className="avatar" style={{background:l.accent}}>{l.initials}</span><div><strong>{l.name}</strong><small>{l.email}</small></div></td><td>{l.company}</td><td><StatusPill status={l.status}/></td><td>{l.source}</td><td>{l.updated}</td><td>›</td></tr>)}</tbody></table></div>}

function LeadDetail({lead,back,flash,onUpdated}:{lead:Lead;back:()=>void;flash:(s:string)=>void;onUpdated:(lead:Lead)=>void}){
  const [generated,setGenerated]=useState(false),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
  const submitting=useRef(false);
  const closed=lead.status==='CLOSED';
  async function closeLead(){
    if(submitting.current||closed)return;
    submitting.current=true;setSaving(true);setSaveError('');
    try{
      const response=await fetch('/api/leads/'+encodeURIComponent(lead.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'closed'})});
      if(!response.ok)throw new Error('No se pudo guardar');
      const result:{data:ApiLead}=await response.json();
      if(result.data.id!==lead.id||result.data.status!=='closed')throw new Error('Respuesta inválida');
      onUpdated({...lead,status:apiStatuses[result.data.status],updated:new Date(result.data.updatedAt).toLocaleString('es-CO')});
      flash('Lead marcado como cerrado');
    }catch{setSaveError('No se pudo guardar el estado. Inténtalo de nuevo.')}
    finally{submitting.current=false;setSaving(false)}
  }
  return <div className="page"><button className="back" onClick={back}>← Volver a leads</button><div className="detail-heading"><div className="lead-identity"><span className="avatar large" style={{background:lead.accent}}>{lead.initials}</span><div><h1>{lead.name}</h1><p>{lead.company}</p></div></div><StatusPill status={closed?'CLOSED':lead.status}/></div><div className="detail-grid"><section className="conversation panel"><div className="conversation-head"><PanelTitle title="Conversación" sub="WhatsApp · iniciada hoy a las 9:18 a. m."/><span>● En línea</span></div><div className="messages"><div className="day">HOY</div><Message who="Laura" time="9:18 a. m." text="Hola, quisiera saber cuánto cuesta automatizar el WhatsApp de mi negocio."/><Message agent who="Tú" time="9:20 a. m." text="¡Hola, Laura! Claro. ¿Qué tipo de negocio tienes y cuántos mensajes reciben aproximadamente?"/><Message who="Laura" time="9:23 a. m." text="Una estética en Medellín. Recibimos unos 80 mensajes diarios y casi todos preguntan por los mismos precios."/><Message agent who="Tú" time="9:25 a. m." text="Perfecto, hay una buena oportunidad de automatización. Podemos revisar sus flujos y recomendarte un plan."/></div><form className="composer" onSubmit={e=>{e.preventDefault();flash('Mensaje enviado')}}><input placeholder="Escribe una respuesta..."/><button>Enviar ↑</button></form></section><aside className="lead-sidebar"><section className="panel contact-card"><PanelTitle title="Información" sub="Datos de contacto"/><Info label="Email" value={lead.email}/><Info label="Teléfono" value={lead.phone}/><Info label="Empresa" value={lead.company}/><Info label="Origen" value={lead.source}/></section><section className="panel ai-card"><AiHeading/>{generated?<><div className="score"><strong>92<small>/100</small></strong><span>INTENCIÓN ALTA</span></div><p>Negocio de belleza con 80 mensajes diarios. Interés claro en automatizar consultas repetitivas de precios por WhatsApp.</p><h3>ACCIÓN RECOMENDADA</h3><div className="recommendation">↗ Agendar una demo en las próximas 24 horas.</div><div className="topics"><span>WhatsApp</span><span>Automatización</span><span>Precios</span></div></>:<div className="ai-empty">Analiza la conversación para detectar intención, temas y el siguiente paso comercial.</div>}<button className="ai-button" onClick={()=>{setGenerated(true);flash('Análisis generado')}}>✦ {generated?'Actualizar análisis':'Generar análisis'}</button></section><button className="close-button" disabled={closed||saving} onClick={()=>void closeLead()}>✓ {saving?'Guardando…':closed?'Lead cerrado':'Marcar como cerrado'}</button>{saveError&&<p className="form-error" role="alert">{saveError}</p>}</aside></div></div>}
function Message({who,time,text,agent}:{who:string;time:string;text:string;agent?:boolean}){return <div className={`message ${agent?'agent':''}`}><div><strong>{who}</strong><small>{time}</small></div><p>{text}</p></div>}
function Info({label,value}:{label:string;value:string}){return <div className="info-row"><span>{label}</span><strong>{value}</strong></div>}
function AiHeading(){return <div className="ai-heading"><span>✦</span><div><h2>Análisis con IA</h2><p>Insights comerciales estructurados</p></div></div>}

function Simulator({messages,setMessages,analyzed,setAnalyzed}:{messages:{sender:string;text:string}[];setMessages:React.Dispatch<React.SetStateAction<{sender:string;text:string}[]>>;analyzed:boolean;setAnalyzed:(v:boolean)=>void}){const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget),text=String(f.get('message')||'').trim();if(!text)return;setMessages(old=>[...old,{sender:'customer',text},{sender:'ai',text:old.length<3?'Perfecto. ¿Cuántas consultas reciben al día y qué preguntas se repiten más?':'Con ese volumen podemos automatizar las respuestas frecuentes y derivar las oportunidades al equipo.'}]);e.currentTarget.reset();setAnalyzed(false)};return <div className="page"><Heading eyebrow="LABORATORIO COMERCIAL" title="Simulador de conversación" subtitle="Prueba el asistente y analiza una oportunidad en tiempo real."/><div className="sim-grid"><section className="panel sim-chat"><div className="sim-header"><span>✦</span><div><strong>AI Sales Assistant</strong><small>● Disponible</small></div></div><div className="sim-messages">{messages.map((m,i)=><div key={i} className={`sim-message ${m.sender}`}><b>{m.sender==='ai'?'IA':'Tú'}</b><p>{m.text}</p></div>)}</div><form className="sim-input" onSubmit={submit}><input name="message" placeholder="Escribe como si fueras un cliente..."/><button>↑</button></form></section><aside className="panel analysis"><AiHeading/>{analyzed?<div className="analysis-content"><div className="score-ring"><strong>87</strong><span>/100</span></div><StatusPill status="INTERESTED"/><h3>RESUMEN</h3><p>Propietario de un negocio interesado en automatizar la atención recurrente por WhatsApp.</p><h3>SIGUIENTE PASO</h3><div className="recommendation">Contactar en las próximas 24 horas para una demo personalizada.</div></div>:<div className="analysis-empty"><span>✦</span><h3>Convierte mensajes en señales</h3><p>Obtén intención, score y siguiente acción.</p></div>}<button className="ai-button" disabled={messages.length<2} onClick={()=>setAnalyzed(true)}>✦ Analizar conversación</button></aside></div></div>}
function Placeholder({page}:{page:Page}){const names:Record<Page,string>={dashboard:'',leads:'',conversations:'Conversaciones',analytics:'Analítica',simulator:'',settings:'Ajustes'};return <div className="page placeholder"><span>✦</span><h1>{names[page]}</h1><p>Esta sección está lista para conectarse con los datos del equipo.</p></div>}
