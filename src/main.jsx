import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookOpen, CalendarDays, ChartNoAxesColumnIncreasing, Plus, Search, Settings2, Download, Upload, Check, X, ChevronRight, Languages, Trash2, RotateCcw, Menu } from "lucide-react";
import "./styles.css";

const STORAGE = "deutsch-memo-v1";
const STEPS = [1, 3, 7, 21, 45, 90];
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date, n) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
const seed = [
  {id:uid(),fr:"la table",de:"der Tisch",type:"nom",gender:"masculin",plural:"die Tische",level:0,due:today(),created:today(),reviews:0,misses:0,lastReviewed:null},
  {id:uid(),fr:"la maison",de:"das Haus",type:"nom",gender:"neutre",plural:"die Häuser",level:0,due:today(),created:today(),reviews:0,misses:0,lastReviewed:null},
  {id:uid(),fr:"le temps / la météo",de:"das Wetter",type:"nom",gender:"neutre",plural:"—",level:0,due:today(),created:today(),reviews:0,misses:0,lastReviewed:null},
  {id:uid(),fr:"apprendre",de:"lernen",type:"verbe",gender:"",plural:"",level:0,due:today(),created:today(),reviews:0,misses:0,lastReviewed:null},
  {id:uid(),fr:"important",de:"wichtig",type:"adjectif",gender:"",plural:"",level:0,due:today(),created:today(),reviews:0,misses:0,lastReviewed:null},
  {id:uid(),fr:"bonjour",de:"Guten Tag",type:"expression",gender:"",plural:"",level:0,due:today(),created:today(),reviews:0,misses:0,lastReviewed:null}
];
function loadWords(){ try { const x=JSON.parse(localStorage.getItem(STORAGE)); return Array.isArray(x) ? x : seed; } catch { return seed; } }
function App(){
  const [words,setWords] = useState(loadWords);
  const [tab,setTab] = useState("home");
  const [search,setSearch] = useState("");
  const [queue,setQueue] = useState([]);
  const [index,setIndex] = useState(0);
  const [answer,setAnswer] = useState("");
  const [plural,setPlural] = useState("");
  const [revealed,setRevealed] = useState(false);
  const [feedback,setFeedback] = useState("");
  const [form,setForm] = useState({fr:"",de:"",type:"nom",plural:""});
  const [checking,setChecking] = useState(false);
  const [checkReport,setCheckReport] = useState("");
  const [editing,setEditing] = useState(null);
  const [toast,setToast] = useState("");
  const [mobileNav,setMobileNav] = useState(false);

  useEffect(()=>{ localStorage.setItem(STORAGE,JSON.stringify(words)); },[words]);
  useEffect(()=>{ if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{}); },[]);
  const due = useMemo(()=>words.filter(w=>w.due<=today()),[words]);
  const completedToday = useMemo(()=>words.filter(w=>w.lastReviewed===today()).length,[words]);
  const remaining = Math.max(0,10-completedToday);
  const filtered = words.filter(w=>(w.fr+" "+w.de).toLowerCase().includes(search.toLowerCase()));
  const current = queue[index];
  const notify = msg => { setToast(msg); setTimeout(()=>setToast(""),2600); };

  function startReview(){
    const dueWords = words.filter(w=>w.due<=today()).sort((a,b)=>a.due.localeCompare(b.due));
    const notDue = words.filter(w=>w.due>today() && w.lastReviewed!==today()).sort((a,b)=>(a.lastReviewed||"").localeCompare(b.lastReviewed||""));
    const selected = [...dueWords, ...notDue].slice(0,Math.min(words.length,Math.max(10,dueWords.length)));
    if(!selected.length){notify("Ajoute quelques mots pour commencer.");setTab("vocab");return;}
    setQueue(selected.map(w=>w.id)); setIndex(0); resetCard(); setTab("review");
  }
  function resetCard(){setAnswer("");setPlural("");setRevealed(false);setFeedback("");}
  function checkAnswer(){
    if(!current)return;
    const w=words.find(x=>x.id===current); if(!w)return;
    const norm=s=>s.trim().toLocaleLowerCase("de-DE").replace(/[.!?]/g,"").replace(/\s+/g," ");
    const translationOK=norm(answer)===norm(w.de);
    const pluralOK=w.type!=="nom" || !w.plural || norm(plural)===norm(w.plural||"");
    const ok=translationOK&&pluralOK;
    setFeedback(ok?"correct":"wrong"); setRevealed(true);
    setWords(prev=>prev.map(x=>{
      if(x.id!==current)return x;
      if(ok){ const next=Math.min(x.level+1,STEPS.length); return {...x,level:next,due:addDays(today(), next===0?0:STEPS[next-1]),reviews:(x.reviews||0)+1,lastReviewed:today()}; }
      return {...x,level:0,due:addDays(today(),1),reviews:(x.reviews||0)+1,misses:(x.misses||0)+1,lastReviewed:today()};
    }));
  }
  function nextCard(){ if(index+1>=queue.length){setTab("home");notify("Session terminée. Bien joué !");} else {setIndex(i=>i+1);resetCard();} }
  function saveWord(e){
    e.preventDefault();
    if(!form.fr.trim()||!form.de.trim())return;
    const base={...form,fr:form.fr.trim(),de:form.de.trim(),created:today(),due:today(),level:0,reviews:0,misses:0,lastReviewed:null};
    if(editing){setWords(p=>p.map(w=>w.id===editing?{...w,...base}:w));notify("Mot modifié.");}
    else {setWords(p=>[{...base,id:uid()},...p]);notify("Mot ajouté à tes révisions.");}
    setForm({fr:"",de:"",type:"nom",plural:""});setEditing(null);setCheckReport("");setTab("vocab");
  }
  async function checkEntry(){
    if(!form.fr.trim()||!form.de.trim()){setCheckReport("Renseigne les deux mots avant de lancer la vérification.");return;}
    setChecking(true);setCheckReport("Vérification en cours…");
    const norm=s=>s.trim().toLocaleLowerCase("de-DE").replace(/[.!?]/g,"").replace(/\s+/g," ");
    try {
      const spellingUrl=new URL("https://api.languagetool.org/v2/check");
      spellingUrl.searchParams.set("language","de-DE"); spellingUrl.searchParams.set("text",form.de.trim());
      const [spellRes,transRes]=await Promise.all([
        fetch(spellingUrl),
        fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(form.fr.trim())}&langpair=fr|de`)
      ]);
      if(!spellRes.ok||!transRes.ok) throw new Error("Service indisponible");
      const spell=await spellRes.json(); const trans=await transRes.json();
      const issues=(spell.matches||[]).filter(m=>m.rule?.issueType==="misspelling"||m.rule?.category?.id==="TYPOS");
      const suggestions=[...new Set(issues.flatMap(m=>(m.replacements||[]).slice(0,3).map(x=>x.value)))].slice(0,5);
      const machine=trans.responseData?.translatedText||"";
      const translationClose=machine && (norm(machine)===norm(form.de)||norm(machine).includes(norm(form.de))||norm(form.de).includes(norm(machine)));
      let msg="";
      if(suggestions.length) msg=`Orthographe à vérifier : ${suggestions.join(" / ")}. `;
      else msg="Aucune faute d’orthographe évidente détectée. ";
      if(machine) msg+=translationClose?"La traduction semble cohérente avec la suggestion du dictionnaire automatique.":`La traduction automatique proposée est « ${machine} ». Compare-la avec ton entrée : il peut y avoir plusieurs traductions correctes.`;
      else msg+="La vérification de traduction n’a pas donné de résultat.";
      setCheckReport(msg);
    } catch { setCheckReport("La vérification en ligne est momentanément indisponible. Vérifie ta connexion ou réessaie plus tard ; tu peux quand même enregistrer ton mot."); }
    finally {setChecking(false);}
  }
  function editWord(w){setForm({fr:w.fr,de:w.de,type:w.type,plural:w.plural||""});setCheckReport("");setEditing(w.id);setTab("add");}
  function removeWord(id){if(confirm("Supprimer définitivement ce mot ?"))setWords(p=>p.filter(w=>w.id!==id));}
  function exportData(){const blob=new Blob([JSON.stringify(words,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="deutsch-memo-vocabulaire.json";a.click();URL.revokeObjectURL(a.href);}
  function importData(e){const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const parsed=JSON.parse(r.result);if(!Array.isArray(parsed))throw Error();setWords(parsed);notify("Sauvegarde importée.");}catch{notify("Fichier invalide.");}};r.readAsText(file);e.target.value="";}
  const nav=[["home","Accueil",CalendarDays],["review","Réviser",Languages],["vocab","Vocabulaire",BookOpen],["stats","Statistiques",ChartNoAxesColumnIncreasing]];
  const noun=form.type==="nom";
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?"open":""}`}>
      <div className="brand"><div className="brand-icon">D</div><div><b>Deutsch Memo</b><small>Ton carnet d'allemand</small></div></div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={tab===id?"nav-item active":"nav-item"} onClick={()=>{setTab(id);setMobileNav(false);}}><Icon size={18}/><span>{label}</span>{id==="review"&&due.length>0&&<em>{due.length}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sync-note"><span className="status-dot"/>Données enregistrées sur cet appareil</div><button className="nav-item" onClick={()=>setTab("settings")}><Settings2 size={18}/>Paramètres</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(!mobileNav)}><Menu/></button><div className="crumb">Allemand <ChevronRight size={14}/> <b>{nav.find(n=>n[0]===tab)?.[1]||"Paramètres"}</b></div><div className="top-date">{new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long"}).format(new Date())}</div></header>
      <div className="content">
        {tab==="home"&&<><div className="page-heading"><div><p className="eyebrow">GUTEN TAG</p><h1>Prêt·e à progresser ?</h1><p className="muted">Quelques minutes aujourd'hui feront la différence.</p></div><button className="primary" onClick={startReview}><Languages size={17}/> Commencer à réviser</button></div>
          <section className="hero-card"><div><span className="hero-label">TON OBJECTIF QUOTIDIEN</span><h2>{Math.min(completedToday,10)} <span>/ 10 mots</span></h2><p>{completedToday>=10?"Objectif atteint. Bravo !":`${10-completedToday} mot${10-completedToday>1?"s":""} pour atteindre ton objectif.`}</p><div className="progress"><span style={{width:`${Math.min(100,completedToday*10)}%`}}/></div></div><div className="hero-mark">10</div></section>
          <div className="stat-grid"><Stat label="À revoir aujourd'hui" value={due.length} hint="Mots arrivés à échéance" icon={<CalendarDays/>}/><Stat label="Mots dans ton carnet" value={words.length} hint="Tout ton vocabulaire" icon={<BookOpen/>}/><Stat label="Révisés aujourd'hui" value={completedToday} hint="Mots travaillés aujourd'hui" icon={<Check/>}/></div>
          <section className="panel"><div className="panel-head"><div><h3>À revoir aujourd'hui</h3><p className="muted">Tes mots dont la prochaine révision est arrivée.</p></div><button className="text-btn" onClick={()=>setTab("review")}>Voir la session <ChevronRight size={15}/></button></div>
            {due.length===0?<div className="empty"><div className="empty-icon"><Check/></div><b>Tout est à jour !</b><p>Ajoute de nouveaux mots ou profite de ta journée.</p></div>:<div className="due-list">{due.slice(0,5).map(w=><div className="due-row" key={w.id}><div className="word-avatar">{w.type==="nom"?"N":w.type==="verbe"?"V":w.type==="adjectif"?"A":"E"}</div><div className="word-main"><b>{w.fr}</b><small>{w.type==="nom"?"Nom":w.type}</small></div><span className="due-tag">À réviser</span></div>)}</div>}
          </section>
          <button className="add-shortcut" onClick={()=>{setEditing(null);setForm({fr:"",de:"",type:"nom",plural:""});setTab("add");}}><span><Plus/></span><div><b>Ajouter un nouveau mot</b><small>Enrichis ton vocabulaire allemand</small></div><ChevronRight/></button>
        </>}
        {tab==="review"&&<><div className="page-heading"><div><p className="eyebrow">ENTRAÎNEMENT</p><h1>Révision quotidienne</h1><p className="muted">Traduis du français vers l'allemand, sans regarder la réponse.</p></div></div>
          {!current?<div className="panel empty big-empty"><div className="empty-icon"><Check/></div><h3>Prêt pour ta prochaine session ?</h3><p>Ta session contient les mots dus, puis des mots supplémentaires pour viser 10 révisions.</p><button className="primary" onClick={startReview}>Préparer ma session</button></div>:<div className="review-wrap"><div className="review-meta"><span>Mot {index+1} sur {queue.length}</span><span>{Math.round((index/queue.length)*100)} %</span></div><div className="progress"><span style={{width:`${(index/queue.length)*100}%`}}/></div><div className="review-card"><span className="eyebrow">TRADUIS EN ALLEMAND</span><h2>{words.find(w=>w.id===current)?.fr}</h2><p className="muted">Écris la traduction dont tu te souviens.</p><input className="answer-input" value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!revealed&&checkAnswer()} placeholder="Ta réponse en allemand…" disabled={revealed}/>
              {words.find(w=>w.id===current)?.type==="nom"&&words.find(w=>w.id===current)?.plural&&<div className="grammar-fields"><label>Pluriel<input value={plural} onChange={e=>setPlural(e.target.value)} placeholder="Ex. die Tische" disabled={revealed}/></label></div>}
              {!revealed?<button className="primary full" onClick={checkAnswer} disabled={!answer.trim()}>Vérifier ma réponse</button>:<div className={`answer-result ${feedback}`}><div className="result-title">{feedback==="correct"?<Check/>:<X/>}{feedback==="correct"?"Bonne réponse !":"À retravailler"}</div><b>{words.find(w=>w.id===current)?.de}</b>{words.find(w=>w.id===current)?.type==="nom"&&<p>Pluriel : {words.find(w=>w.id===current)?.plural||"non renseigné"}</p>}<small>{feedback==="correct"?"Le prochain intervalle sera plus long.":"Ce mot reviendra demain."}</small><button className="primary full" onClick={nextCard}>{index+1===queue.length?"Terminer la session":"Mot suivant" } <ChevronRight size={16}/></button></div>}
            </div></div>}
        </>}
        {tab==="vocab"&&<><div className="page-heading"><div><p className="eyebrow">TON DICTIONNAIRE</p><h1>Mon vocabulaire</h1><p className="muted">{words.length} mot{words.length>1?"s":""} enregistré{words.length>1?"s":""}</p></div><button className="primary" onClick={()=>{setEditing(null);setForm({fr:"",de:"",type:"nom",plural:""});setTab("add");}}><Plus size={17}/> Ajouter un mot</button></div><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un mot français ou allemand…"/></div><section className="panel vocab-panel">{filtered.length===0?<div className="empty">Aucun mot trouvé.</div>:filtered.map(w=><div className="vocab-row" key={w.id}><div className="word-avatar">{w.type==="nom"?"N":w.type==="verbe"?"V":w.type==="adjectif"?"A":"E"}</div><div className="vocab-words"><b>{w.fr}</b><span>{w.de}</span>{w.type==="nom"&&<small>Pluriel : {w.plural||"non renseigné"}</small>}</div><span className="level-pill">Niveau {w.level||0}</span><button className="icon-btn" title="Modifier" onClick={()=>editWord(w)}><Settings2 size={17}/></button><button className="icon-btn danger" title="Supprimer" onClick={()=>removeWord(w.id)}><Trash2 size={17}/></button></div>)}</section></>}
        {tab==="add"&&<><div className="page-heading"><div><p className="eyebrow">NOUVEAU VOCABULAIRE</p><h1>{editing?"Modifier le mot":"Ajouter un mot"}</h1><p className="muted">Les nouveaux mots sont proposés dès ta prochaine session.</p></div></div><form className="panel form-panel" onSubmit={saveWord}><div className="form-grid"><label>Mot ou expression en français<input required value={form.fr} onChange={e=>setForm({...form,fr:e.target.value})} placeholder="Ex. la fenêtre"/></label><label>Traduction allemande<input required value={form.de} onChange={e=>setForm({...form,de:e.target.value})} placeholder="Ex. das Fenster"/></label></div><label>Catégorie<select value={form.type} onChange={e=>setForm({...form,type:e.target.value,plural:e.target.value==="nom"?form.plural:""})}><option value="nom">Nom</option><option value="verbe">Verbe</option><option value="adjectif">Adjectif</option><option value="expression">Expression</option></select></label>{noun&&<div className="grammar-fields"><label>Forme au pluriel (facultatif)<input value={form.plural} onChange={e=>setForm({...form,plural:e.target.value})} placeholder="Ex. die Fenster"/></label></div>}<div className="checker"><button type="button" className="secondary" onClick={checkEntry} disabled={checking}><Languages size={17}/>{checking?"Vérification…":"Vérifier l’orthographe et la traduction"}</button>{checkReport&&<p className="check-report">{checkReport}</p>}<small>La vérification utilise des services gratuits en ligne. Les suggestions automatiques peuvent se tromper : vérifie-les avant d’enregistrer.</small></div><div className="form-actions"><button type="button" className="secondary" onClick={()=>setTab("vocab")}>Annuler</button><button className="primary" type="submit"><Check size={17}/> {editing?"Enregistrer":"Ajouter à mon vocabulaire"}</button></div></form></>}
        {tab==="stats"&&<><div className="page-heading"><div><p className="eyebrow">TON ÉVOLUTION</p><h1>Statistiques</h1><p className="muted">Un aperçu de ton apprentissage.</p></div></div><div className="stat-grid"><Stat label="Mots appris" value={words.length} hint="Dans ton carnet" icon={<BookOpen/>}/><Stat label="Révisions effectuées" value={words.reduce((s,w)=>s+(w.reviews||0),0)} hint="Depuis le début" icon={<RotateCcw/>}/><Stat label="Réponses à retravailler" value={words.reduce((s,w)=>s+(w.misses||0),0)} hint="Erreurs cumulées" icon={<Languages/>}/></div><section className="panel"><h3>Répartition par niveau</h3><p className="muted">Plus le niveau est élevé, plus l'intervalle de révision est long.</p>{[0,1,2,3,4,5,6].map(l=>{const count=words.filter(w=>(w.level||0)===l).length;return <div className="level-row" key={l}><span>Niveau {l}</span><div className="mini-track"><i style={{width:`${words.length?count/words.length*100:0}%`}}/></div><b>{count}</b></div>})}</section></>}
        {tab==="settings"&&<><div className="page-heading"><div><p className="eyebrow">PRÉFÉRENCES</p><h1>Paramètres</h1><p className="muted">Gère tes données et ton application.</p></div></div><section className="panel settings-panel"><h3>Sauvegarde du vocabulaire</h3><p className="muted">Exporte tes mots pour les sauvegarder ou les transférer vers un autre appareil. L'import remplace le carnet actuel.</p><div className="settings-actions"><button className="secondary" onClick={exportData}><Download size={17}/> Exporter mes mots</button><label className="secondary file-button"><Upload size={17}/> Importer une sauvegarde<input type="file" accept="application/json" onChange={importData}/></label></div><div className="notice"><b>À propos de la synchronisation</b><p>Cette première version enregistre les données dans le navigateur de chaque appareil. Pour retrouver automatiquement les mêmes mots sur ton téléphone et ton ordinateur, il faudra connecter un espace cloud sécurisé dans une prochaine étape.</p></div><div className="notice"><b>Répétition espacée</b><p>Réponse correcte : passage aux intervalles 1, 3, 7, 21, 45 puis 90 jours. Réponse incorrecte : retour le lendemain. Les mots sont sélectionnés pour viser au moins 10 révisions par jour, si ton carnet contient assez de mots.</p></div></section></>}
      </div>
    </main>
    {toast&&<div className="toast">{toast}</div>}
  </div>;
}
function Stat({label,value,hint,icon}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{hint}</small></div>}
createRoot(document.getElementById("root")).render(<App/>);