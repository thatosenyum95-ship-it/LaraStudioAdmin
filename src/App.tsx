import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { LayoutDashboard, Package, Plus, LogOut, ShieldCheck, Search, Pencil, Trash2, Upload, X, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

type AppRow = {
  id:string; name:string; category:string|null; version:string|null; size:string|null; android:string|null;
  sha256:string|null; verified:boolean; download_url:string|null; created_at:string;
  short_description:string|null; description:string|null; developer:string|null; icon_url:string|null;
  page_slug:string|null; official:boolean; status:"draft"|"published"|"archived"; published_at:string|null;
  updated_at:string;
};
type Feature={id:string;app_id:string;title:string;description:string|null;icon:string|null;sort_order:number};
type Release={id:string;app_id:string;version:string;version_code:number|null;apk_path:string|null;apk_size_bytes:number|null;sha256:string|null;min_android:string|null;architectures:string[]|null;release_notes:string|null;is_current:boolean;status:"draft"|"published"|"archived"};

const emptyForm={name:"",category:"Utilities",short_description:"",description:"",developer:"",page_slug:"",version:"1.0.0",size:"",android:"Android 8.0+",sha256:"",download_url:"",official:false,status:"draft" as const};

export default function App(){
  const [session,setSession]=useState<any>(null);
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [loginError,setLoginError]=useState(""); const [busy,setBusy]=useState(false);
  const [apps,setApps]=useState<AppRow[]>([]); const [selected,setSelected]=useState<AppRow|null>(null);
  const [form,setForm]=useState(emptyForm); const [features,setFeatures]=useState<Feature[]>([]);
  const [releases,setReleases]=useState<Release[]>([]); const [query,setQuery]=useState("");
  const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null); const [view,setView]=useState<"dashboard"|"apps">("dashboard");

  useEffect(()=>{ supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return()=>data.subscription.unsubscribe(); },[]);
  useEffect(()=>{ if(session) loadApps(); },[session]);

  async function loadApps(){
    setBusy(true); const {data,error}=await supabase.from("store_apps").select("*").order("updated_at",{ascending:false});
    if(error) flash(false,error.message); else setApps((data||[]) as AppRow[]); setBusy(false);
  }
  function flash(ok:boolean,text:string){setNotice({ok,text});setTimeout(()=>setNotice(null),3500)}
  function selectApp(a:AppRow){setSelected(a);setForm({name:a.name,category:a.category||"",short_description:a.short_description||"",description:a.description||"",developer:a.developer||"",page_slug:a.page_slug||"",version:a.version||"1.0.0",size:a.size||"",android:a.android||"",sha256:a.sha256||"",download_url:a.download_url||"",official:a.official,status:a.status}); loadDetails(a.id);}
  async function loadDetails(id:string){
    const [f,r]=await Promise.all([supabase.from("app_features").select("*").eq("app_id",id).order("sort_order"),supabase.from("app_releases").select("*").eq("app_id",id).order("created_at",{ascending:false})]);
    setFeatures((f.data||[]) as Feature[]); setReleases((r.data||[]) as Release[]);
  }
  function newApp(){setSelected(null);setForm(emptyForm);setFeatures([]);setReleases([]);setView("apps")}
  async function saveApp(){
    if(!form.name.trim()) return flash(false,"Nama aplikasi wajib diisi.");
    setBusy(true);
    const slug=form.page_slug.trim()||form.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const payload={...form,page_slug:slug,updated_at:new Date().toISOString(),published_at:form.status==="published"?(selected?.published_at||new Date().toISOString()):null};
    const q=selected ? supabase.from("store_apps").update(payload).eq("id",selected.id).select().single() : supabase.from("store_apps").insert(payload).select().single();
    const {data,error}=await q;
    if(error){flash(false,error.message);setBusy(false);return}
    setSelected(data as AppRow); await loadApps(); flash(true,selected?"Aplikasi diperbarui.":"Aplikasi dibuat sebagai draft."); setBusy(false);
  }
  async function deleteApp(){
    if(!selected || !confirm("Hapus aplikasi ini beserta data adminnya?")) return;
    setBusy(true); const {error}=await supabase.from("store_apps").delete().eq("id",selected.id);
    if(error) flash(false,error.message); else {flash(true,"Aplikasi dihapus.");setSelected(null);setForm(emptyForm);await loadApps();}
    setBusy(false);
  }
  async function addFeature(){
    if(!selected) return flash(false,"Simpan aplikasi dulu.");
    const title=prompt("Nama fitur:"); if(!title) return;
    const {data,error}=await supabase.from("app_features").insert({app_id:selected.id,title,sort_order:features.length}).select().single();
    if(error) flash(false,error.message); else setFeatures([...features,data as Feature]);
  }
  async function removeFeature(id:string){const {error}=await supabase.from("app_features").delete().eq("id",id); if(error)flash(false,error.message);else setFeatures(features.filter(x=>x.id!==id));}
  async function uploadApk(file:File){
    if(!selected)return flash(false,"Simpan aplikasi dulu.");
    if(!file.name.toLowerCase().endsWith(".apk"))return flash(false,"File harus APK.");
    const version=form.version.trim()||"1.0.0";
    const path=`apps/${selected.id}/${version}/${file.name}`;
    setBusy(true);
    const buffer=await file.arrayBuffer();
    const hash=await crypto.subtle.digest("SHA-256",buffer);
    const sha=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const {error}=await supabase.storage.from("lara-apks").upload(path,file,{upsert:true,contentType:"application/vnd.android.package-archive"});
    if(error){flash(false,error.message);setBusy(false);return}
    const {data:urlData}=supabase.storage.from("lara-apks").getPublicUrl(path);
    const {data,error:releaseError}=await supabase.from("app_releases").insert({
      app_id:selected.id,version,apk_path:path,apk_size_bytes:file.size,sha256:sha,
      min_android:form.android,release_notes:"",is_current:false,status:"draft"
    }).select().single();
    if(releaseError){flash(false,releaseError.message);setBusy(false);return}
    await supabase.from("store_apps").update({version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,download_url:urlData.publicUrl,verified:true,updated_at:new Date().toISOString()}).eq("id",selected.id);
    setReleases([releaseError?releaseError:(data as Release),...releases]);
    setSelected({...selected,version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,download_url:urlData.publicUrl,verified:true});
    setForm({...form,version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,download_url:urlData.publicUrl});
    flash(true,"APK diunggah dan SHA-256 dihitung. Release masih draft."); setBusy(false);
  }
  async function makeCurrentRelease(r:Release){
    if(!selected)return;
    await supabase.from("app_releases").update({is_current:false}).eq("app_id",selected.id);
    const {error}=await supabase.from("app_releases").update({is_current:true,status:"published"}).eq("id",r.id);
    if(error)flash(false,error.message);else{flash(true,"Release ditetapkan sebagai current.");await loadDetails(selected.id);}
  }
  async function uploadIcon(file:File){
    if(!selected)return flash(false,"Simpan aplikasi dulu.");
    const ext=file.name.split(".").pop()||"png"; const path=`apps/${selected.id}/icon.${ext}`;
    const {error}=await supabase.storage.from("lara-app-media").upload(path,file,{upsert:true,contentType:file.type});
    if(error)return flash(false,error.message);
    const {data}=supabase.storage.from("lara-app-media").getPublicUrl(path);
    const {error:dbError}=await supabase.from("store_apps").update({icon_url:data.publicUrl}).eq("id",selected.id);
    if(dbError)flash(false,dbError.message);else{setForm({...form,});setSelected({...selected,icon_url:data.publicUrl});flash(true,"Icon berhasil diunggah.")}
  }
  async function publish(){
    if(!selected)return;
    if(!selected.verified) return flash(false,"Verifikasi aplikasi sebelum publish.");
    const {error}=await supabase.from("store_apps").update({status:"published",official:true,published_at:new Date().toISOString()}).eq("id",selected.id);
    if(error)flash(false,error.message);else{flash(true,"Aplikasi dipublikasikan sebagai Official.");await loadApps();setSelected({...selected,status:"published",official:true});}
  }
  async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setLoginError("");const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)setLoginError(error.message);else setSession(data.session);setBusy(false)}
  async function signOut(){await supabase.auth.signOut();setSession(null)}
  const filtered=useMemo(()=>apps.filter(a=>(a.name+" "+(a.category||"")).toLowerCase().includes(query.toLowerCase())),[apps,query]);

  if(!session) return <div className="login"><div className="login-card"><div className="brand-mark">LS</div><h1>Lara Studio Admin</h1><p>Panel privat untuk mengelola aplikasi resmi Lara Studio.</p><form onSubmit={signIn}><input type="email" placeholder="Email admin" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/>{loginError&&<div className="error"><AlertCircle size={16}/>{loginError}</div>}<button className="primary wide" disabled={busy}>{busy?"Memeriksa...":"Masuk ke Admin"}</button></form><small>Hanya akun Supabase dengan <b>app_metadata.is_admin=true</b> yang dapat mengelola data.</small></div></div>;

  return <div className="shell">
    <aside><div className="brand"><div className="brand-mark">LS</div><div><b>Lara Studio</b><span>ADMIN</span></div></div>
      <nav><button className={view==="dashboard"?"active":""} onClick={()=>setView("dashboard")}><LayoutDashboard/>Dashboard</button><button className={view==="apps"?"active":""} onClick={()=>setView("apps")}><Package/>Aplikasi</button></nav>
      <div className="side-bottom"><div className="admin-chip"><ShieldCheck size={16}/> Admin terverifikasi</div><button className="logout" onClick={signOut}><LogOut/>Keluar</button></div>
    </aside>
    <main><header><div><h2>{view==="dashboard"?"Dashboard":"Manajemen Aplikasi"}</h2><p>Kelola katalog publik tanpa menyentuh website Lara Studio.</p></div><button className="ghost" onClick={loadApps}><RefreshCw size={17}/>Refresh</button></header>
      {notice&&<div className={notice.ok?"notice ok":"notice"}>{notice.ok?<CheckCircle2/>:<AlertCircle/>}{notice.text}</div>}
      {view==="dashboard" ? <Dashboard apps={apps} onNew={newApp} onSelect={(a)=>{selectApp(a);setView("apps")}}/> :
      <div className="content-grid"><section className="panel"><div className="panel-head"><div><b>Aplikasi</b><span>{apps.length} item</span></div><button className="primary" onClick={newApp}><Plus size={17}/>Tambah APK</button></div><div className="search"><Search size={17}/><input placeholder="Cari aplikasi..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="app-list">{filtered.map(a=><button key={a.id} className={selected?.id===a.id?"app-row selected":"app-row"} onClick={()=>selectApp(a)}><div className="app-icon">{a.icon_url?<img src={a.icon_url}/>:<Package/>}</div><div className="app-meta"><b>{a.name}</b><span>{a.version||"—"} · {a.category||"Uncategorized"}</span></div><span className={"pill "+a.status}>{a.status}</span>{a.official&&<span className="official">OFFICIAL</span>}</button>)}</div></section>
      <section className="panel editor">{selected||form.name ? <><div className="panel-head"><div><b>{selected?"Edit Aplikasi":"Aplikasi Baru"}</b><span>{selected?.id||"Belum disimpan"}</span></div>{selected&&<button className="danger" onClick={deleteApp}><Trash2 size={16}/></button>}</div>
        <div className="form-grid">{[["name","Nama aplikasi"],["developer","Developer / publisher"],["category","Kategori"],["version","Versi"],["size","Ukuran APK"],["android","Minimum Android"],["page_slug","Slug halaman"],["download_url","URL download"]].map(([k,l])=><label key={k}>{l}<input value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}
        <label className="full">Deskripsi singkat<textarea rows={2} value={form.short_description} onChange={e=>setForm({...form,short_description:e.target.value})}/></label><label className="full">Deskripsi lengkap<textarea rows={6} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="full">SHA-256<input value={form.sha256} onChange={e=>setForm({...form,sha256:e.target.value})}/></label></div>
        <div className="toggles"><label><input type="checkbox" checked={form.official} onChange={e=>setForm({...form,official:e.target.checked})}/> Official</label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as any})}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
        <div className="actions"><button className="primary" onClick={saveApp} disabled={busy}>{busy?"Menyimpan...":"Simpan perubahan"}</button>{selected&&<button className="publish" onClick={publish}><ShieldCheck size={16}/>Verifikasi & Publish</button>}</div>
        {selected&&<><div className="subpanel"><div className="subhead"><b>Icon aplikasi</b><label className="upload"><Upload size={16}/>Upload icon<input type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&uploadIcon(e.target.files[0])}/></label></div>{selected.icon_url&&<img className="preview-icon" src={selected.icon_url}/>}</div>
        <div className="subpanel"><div className="subhead"><b>Fitur aplikasi</b><button className="ghost small" onClick={addFeature}><Plus size={15}/>Tambah</button></div>{features.map(f=><div className="feature-row" key={f.id}><span>{f.title}</span><button onClick={()=>removeFeature(f.id)}><X size={15}/></button></div>)}{!features.length&&<small>Belum ada fitur.</small>}</div>
        <div className="subpanel"><div className="subhead"><b>Rilis APK</b><label className="upload"><Upload size={16}/>Upload APK<input type="file" accept=".apk,application/vnd.android.package-archive" onChange={e=>e.target.files?.[0]&&uploadApk(e.target.files[0])}/></label></div>{releases.map(r=><div className="release-row" key={r.id}><div><b>v{r.version}</b><span>{r.apk_size_bytes?((r.apk_size_bytes/1024/1024).toFixed(2)+" MB"):"—"} · {r.status} · SHA {r.sha256?.slice(0,12)||"—"}…</span></div>{r.is_current?<span className="official">CURRENT</span>:<button className="ghost small" onClick={()=>makeCurrentRelease(r)}>Jadikan current</button>}</div>)}{!releases.length&&<small>Belum ada release. Upload APK untuk membuat release draft dan menghitung SHA-256.</small>}</div></>}</> : <div className="empty"><Package size={40}/><b>Pilih aplikasi</b><span>Atau buat aplikasi baru untuk mulai.</span><button className="primary" onClick={newApp}><Plus size={16}/>Tambah APK</button></div>}</section></div>}
    </main>
  </div>
}

function Dashboard({apps,onNew,onSelect}:{apps:AppRow[];onNew:()=>void;onSelect:(a:AppRow)=>void}){
 const published=apps.filter(a=>a.status==="published").length, official=apps.filter(a=>a.official).length, drafts=apps.filter(a=>a.status==="draft").length;
 return <div className="dash"><div className="stats"><div><Package/><span>Total aplikasi</span><b>{apps.length}</b></div><div><CheckCircle2/><span>Published</span><b>{published}</b></div><div><ShieldCheck/><span>Official</span><b>{official}</b></div><div><Pencil/><span>Draft</span><b>{drafts}</b></div></div><section className="hero-panel"><div><span className="eyebrow">LARA STUDIO CONTROL CENTER</span><h3>Kelola katalog aplikasi secara terpusat.</h3><p>Tambah APK, metadata, icon, fitur, rilis, dan status publikasi dari satu panel privat.</p><button className="primary" onClick={onNew}><Plus size={17}/>Tambah aplikasi</button></div><div className="hero-art">LS</div></section><section className="panel"><div className="panel-head"><div><b>Terbaru</b><span>{apps.length} aplikasi</span></div></div>{apps.slice(0,6).map(a=><button className="app-row" key={a.id} onClick={()=>onSelect(a)}><div className="app-icon">{a.icon_url?<img src={a.icon_url}/>:<Package/>}</div><div className="app-meta"><b>{a.name}</b><span>v{a.version||"—"} · {a.category||"—"}</span></div><span className={"pill "+a.status}>{a.status}</span></button>)}</section></div>
}