import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { LayoutDashboard, Package, Plus, LogOut, ShieldCheck, Search, Pencil, Archive, Upload, X, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

type AppRow = {
  id:string; name:string; category:string|null; version:string|null; size:string|null; android:string|null;
  sha256:string|null; verified:boolean; download_url:string|null; created_at:string;
  short_description:string|null; description:string|null; developer:string|null; icon_url:string|null;
  page_slug:string|null; official:boolean; status:"draft"|"published"|"archived"; published_at:string|null;
  updated_at:string;
};
type Feature={id:string;app_id:string;title:string;description:string|null;icon:string|null;sort_order:number};
type Release={id:string;app_id:string;version:string;version_code:number|null;apk_path:string|null;apk_size_bytes:number|null;sha256:string|null;min_android:string|null;architectures:string[]|null;release_notes:string|null;is_current:boolean;status:"draft"|"published"|"archived"};

type AppForm={name:string;category:string;short_description:string;description:string;developer:string;page_slug:string;version:string;size:string;android:string;sha256:string;download_url:string;icon_url:string;official:boolean;status:"draft"|"published"|"archived"};

const emptyForm:AppForm={name:"",category:"Utilities",short_description:"",description:"",developer:"",page_slug:"",version:"1.0.0",size:"",android:"Android 8.0+",sha256:"",download_url:"",icon_url:"",official:false,status:"draft"};
const PUBLIC_CATALOG_URL="https://thatosenyum95-ship-it.github.io/lara-game-studio/apps.json";

export default function App(){
  const [session,setSession]=useState<any>(null);
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [loginError,setLoginError]=useState(""); const [busy,setBusy]=useState(false);
  const [apps,setApps]=useState<AppRow[]>([]); const [selected,setSelected]=useState<AppRow|null>(null);
  const [form,setForm]=useState(emptyForm); const [features,setFeatures]=useState<Feature[]>([]);
  const [releases,setReleases]=useState<Release[]>([]); const [query,setQuery]=useState(""); const [creating,setCreating]=useState(false); const [newApkFile,setNewApkFile]=useState<File|null>(null); const [newApkVersionCode,setNewApkVersionCode]=useState<number|null>(null);
  const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null); const [view,setView]=useState<"dashboard"|"apps">("dashboard");

  useEffect(()=>{ supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return()=>data.subscription.unsubscribe(); },[]);
  useEffect(()=>{ if(session && session.user?.app_metadata?.is_admin===true) loadApps(); },[session]);

  async function syncPublicCatalog(){
    const response=await fetch(PUBLIC_CATALOG_URL+"?sync="+Date.now(),{cache:"no-store"});
    if(!response.ok) throw new Error("Katalog Lara Studio tidak dapat dibaca.");
    const catalog=await response.json();
    if(!Array.isArray(catalog)) return;
    const published=catalog.filter((a:any)=>a && (a.official===true || String(a.status||"").toLowerCase()==="tersedia"));
    for(const a of published){
      if(!a.id || !a.name) continue;
      const pageSlug=String(a.page||"").replace(/^apps\\//,"").replace(/\\.html$/,"") || String(a.id);
      const payload={
        id:String(a.id), name:String(a.name), category:a.category||"Utilities",
        version:a.version||"1.0.0", size:a.size||null, android:a.android||null,
        sha256:a.sha256||null, verified:a.verified!==false, download_url:a.downloadUrl||null,
        short_description:a.shortDescription||null, description:a.description||null,
        developer:a.developer||"Lara Studio", icon_url:a.iconUrl||null,
        page_slug:pageSlug, official:true, status:"published",
        published_at:new Date().toISOString(), updated_at:new Date().toISOString()
      };
      const {error}=await supabase.from("store_apps").upsert(payload,{onConflict:"id"});
      if(error) throw error;
      const {data:current,error:currentError}=await supabase.from("app_releases").select("*").eq("app_id",String(a.id)).eq("is_current",true).limit(1);
      if(currentError) throw currentError;
      const currentRelease=(current||[])[0] as Release|undefined;
      if(!currentRelease || currentRelease.version!==String(a.version||"1.0.0")){
        if(currentRelease) {
          const {error:e}=await supabase.from("app_releases").update({is_current:false}).eq("id",currentRelease.id);
          if(e) throw e;
        }
        const {error:e}=await supabase.from("app_releases").insert({
          app_id:String(a.id),version:String(a.version||"1.0.0"),version_code:null,
          apk_path:a.downloadUrl||("external://"+String(a.id)),apk_size_bytes:null,sha256:a.sha256||null,min_android:a.android||null,
          architectures:[],release_notes:"Diimpor otomatis dari Lara Studio publik.",
          is_current:true,status:"published"
        });
        if(e) throw e;
      } else if(currentRelease.status!=="published"){
        const {error:e}=await supabase.from("app_releases").update({status:"published",sha256:a.sha256||currentRelease.sha256,min_android:a.android||currentRelease.min_android}).eq("id",currentRelease.id);
        if(e) throw e;
      }
    }
  }
  async function loadApps(){
    setBusy(true);
    try {
      await syncPublicCatalog();
      const {data,error}=await supabase.from("store_apps").select("*").order("updated_at",{ascending:false});
      if(error) throw error;
      setApps((data||[]) as AppRow[]);
    } catch(e:any) {
      flash(false,e?.message || "Gagal memuat katalog.");
    } finally {
      setBusy(false);
    }
  }
  function flash(ok:boolean,text:string){setNotice({ok,text});setTimeout(()=>setNotice(null),3500)}
  function selectApp(a:AppRow){setCreating(false);setNewApkFile(null);setNewApkVersionCode(null);setSelected(a);setForm({name:a.name,category:a.category||"",short_description:a.short_description||"",description:a.description||"",developer:a.developer||"",page_slug:a.page_slug||"",version:a.version||"1.0.0",size:a.size||"",android:a.android||"",sha256:a.sha256||"",download_url:a.download_url||"",icon_url:a.icon_url||"",official:a.official,status:a.status}); loadDetails(a.id);}
  async function loadDetails(id:string){
    const [f,r]=await Promise.all([
      supabase.from("app_features").select("*").eq("app_id",id).order("sort_order"),
      supabase.from("app_releases").select("*").eq("app_id",id).order("created_at",{ascending:false})
    ]);
    if(f.error || r.error){ flash(false, f.error?.message || r.error?.message || "Gagal memuat detail aplikasi."); return; }
    setFeatures((f.data||[]) as Feature[]);
    setReleases((r.data||[]) as Release[]);
  }
  function newApp(){setSelected(null);setForm(emptyForm);setFeatures([]);setReleases([]);setNewApkFile(null);setNewApkVersionCode(null);setCreating(true);setView("apps")}
  function sdkName(sdk?:number){
    if(!sdk) return "Android";
    const map:Record<number,string>={21:"5.0",22:"5.1",23:"6.0",24:"7.0",25:"7.1",26:"8.0",27:"8.1",28:"9",29:"10",30:"11",31:"12",32:"12L",33:"13",34:"14",35:"15",36:"16",37:"17"};
    return "Android "+(map[sdk]||("API "+sdk))+"+";
  }
  function bytesToDataUrl(bytes:Uint8Array){
    let binary=""; const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
    let mime="image/png";
    if(bytes[0]===0xFF&&bytes[1]===0xD8) mime="image/jpeg";
    else if(bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46) mime="image/webp";
    return "data:"+mime+";base64,"+btoa(binary);
  }
  async function inspectApk(file:File){
    if(!file.name.toLowerCase().endsWith(".apk")) return flash(false,"File harus APK.");
    setBusy(true);
    try{
      const buffer=await file.arrayBuffer();
      const parser=(window as any).AppInfoParser;
      if(!parser) throw new Error("Parser APK belum tersedia. Muat ulang halaman Admin.");
      const meta:any=await new parser(file).parse();
      const hash=await crypto.subtle.digest("SHA-256",buffer);
      const sha=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
      let iconUrl="";
      if((window as any).AppInfoParser){
        try{
          const parsed=await new (window as any).AppInfoParser(file).parse();
          if(parsed?.icon) iconUrl=String(parsed.icon);
        }catch{}
      }
      const version=meta.versionName||meta.version||"1.0.0";
      const name=meta.application?.label||meta.label||meta.packageName||file.name.replace(/\\.apk$/i,"");
      const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      setNewApkFile(file); setNewApkVersionCode(Number(meta.versionCode)||null);
      setForm(x=>({...x,name,version,size:(file.size/1024/1024).toFixed(2)+" MB",android:sdkName(Number(meta.minSdkVersion||meta.minSdk||meta.sdkVersion||meta.usesSdk?.minSdkVersion||0)),sha256:sha,page_slug:x.page_slug||slug,icon_url:iconUrl}));
      flash(true,iconUrl?"APK berhasil dibaca: metadata + SHA-256 + icon otomatis.":"APK berhasil dibaca. Metadata dan SHA-256 otomatis; icon akan dicoba lagi saat penyimpanan.");
    }catch(e:any){
      flash(false,e?.message||"APK tidak dapat dibaca. Pastikan file APK valid.");
    }finally{setBusy(false)}
  }
  async function persistNewApk(app:AppRow,file:File,version:string,versionCode:number|null,sha:string){
    const path=`apps/${app.id}/${version}/${file.name}`;
    const {error:uploadError}=await supabase.storage.from("lara-apks").upload(path,file,{upsert:true,contentType:"application/vnd.android.package-archive"});
    if(uploadError) throw uploadError;
    const {data:urlData}=supabase.storage.from("lara-apks").getPublicUrl(path);
    const {data:release,error:releaseError}=await supabase.from("app_releases").insert({
      app_id:app.id,version,version_code:versionCode,apk_path:path,apk_size_bytes:file.size,sha256:sha,
      min_android:app.android,release_notes:"",is_current:true,status:"draft"
    }).select().single();
    if(releaseError) throw releaseError;
    let iconUrl=app.icon_url;
    if(form.icon_url){
      const iconBlob=await (await fetch(form.icon_url)).blob();
      const iconPath=`apps/${app.id}/icon.png`;
      const {error:iconError}=await supabase.storage.from("lara-app-media").upload(iconPath,iconBlob,{upsert:true,contentType:iconBlob.type||"image/png"});
      if(iconError) throw iconError;
      iconUrl=supabase.storage.from("lara-app-media").getPublicUrl(iconPath).data.publicUrl+"?v="+Date.now();
      const {data:media}=await supabase.from("app_media").select("id").eq("app_id",app.id).eq("kind","icon").limit(1);
      if(media?.length) await supabase.from("app_media").update({storage_path:iconPath,sort_order:0}).eq("id",media[0].id);
      else await supabase.from("app_media").insert({app_id:app.id,kind:"icon",storage_path:iconPath,sort_order:0});
      await supabase.from("store_apps").update({icon_url:iconUrl}).eq("id",app.id);
    }
    const next={...app,download_url:urlData.publicUrl,icon_url:iconUrl,verified:true};
    setSelected(next); setForm(x=>({...x,download_url:urlData.publicUrl,icon_url:iconUrl}));
    setReleases([release as Release]);
    return next;
  }
  async function saveApp(){
    if(busy) return;
    if(!form.name.trim()) return flash(false,"Pilih APK terlebih dahulu agar metadata aplikasi terisi otomatis.");
    setBusy(true);
    try{
      const slug=form.page_slug.trim()||form.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      const isNew=!selected;
      const payload={...form,page_slug:slug,icon_url:form.icon_url||null,status:"draft",official:false,published_at:null,updated_at:new Date().toISOString()};
      const q=selected ? supabase.from("store_apps").update(payload).eq("id",selected.id).select().single() : supabase.from("store_apps").insert(payload).select().single();
      const {data,error}=await q;
      if(error) throw error;
      let saved=data as AppRow;
      if(isNew && newApkFile){
        saved=await persistNewApk(saved,newApkFile,form.version,newApkVersionCode,form.sha256);
      }
      setSelected(saved); setCreating(false); setNewApkFile(null); setNewApkVersionCode(null);
      await loadApps();
      await loadDetails(saved.id);
      flash(true,isNew?"Aplikasi ditambahkan. Icon, versi, ukuran, minimum Android dan SHA-256 sudah otomatis tersimpan.":"Aplikasi diperbarui.");
    }catch(e:any){ flash(false,e?.message||"Gagal menyimpan aplikasi."); }
    finally{setBusy(false)}
  }
  async function deleteApp(){
    if(!selected || !confirm("Arsipkan aplikasi ini? Data dan histori rilis akan tetap aman.")) return;
    setBusy(true);
    const {error}=await supabase.from("store_apps").update({status:"archived",updated_at:new Date().toISOString()}).eq("id",selected.id);
    if(error) flash(false,error.message); else {flash(true,"Aplikasi diarsipkan.");await loadApps();setSelected({...selected,status:"archived"});}
    setBusy(false);
  }
  async function addFeature(){
    if(!selected) return flash(false,"Simpan aplikasi dulu.");
    const title=prompt("Nama fitur:");
    if(!title?.trim()) return;
    setBusy(true);
    const {data,error}=await supabase.from("app_features").insert({app_id:selected.id,title:title.trim(),sort_order:features.length}).select().single();
    if(error) flash(false,error.message); else { setFeatures([...features,data as Feature]); flash(true,"Fitur ditambahkan."); }
    setBusy(false);
  }
  async function removeFeature(id:string){
    if(!confirm("Hapus fitur ini?")) return;
    setBusy(true);
    const {error}=await supabase.from("app_features").delete().eq("id",id);
    if(error) flash(false,error.message); else { setFeatures(features.filter(x=>x.id!==id)); flash(true,"Fitur dihapus."); }
    setBusy(false);
  }
  async function uploadApk(file:File){
    if(busy) return;
    if(!selected)return flash(false,"Simpan aplikasi dulu.");
    if(!file.name.toLowerCase().endsWith(".apk"))return flash(false,"File harus APK.");
    const version=form.version.trim()||"1.0.0";
    if(releases.some(r=>r.version===version)) return flash(false,"Release v"+version+" sudah ada. Gunakan nomor versi baru.");
    const path=`apps/${selected.id}/${version}/${file.name}`;
    setBusy(true);
    try {
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
    const {error:appError}=await supabase.from("store_apps").update({version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,download_url:urlData.publicUrl,verified:true,updated_at:new Date().toISOString()}).eq("id",selected.id);
    if(appError){
      await supabase.from("app_releases").delete().eq("id",data?.id);
      flash(false,appError.message);return
    }
    if(data) setReleases([data as Release,...releases]);
    setSelected({...selected,version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,download_url:urlData.publicUrl,verified:true});
    setForm({...form,version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,download_url:urlData.publicUrl});
    flash(true,"APK diunggah dan SHA-256 dihitung. Release masih draft.");
    } catch(e:any) {
      flash(false,e?.message || "Gagal memproses APK.");
    } finally {
      setBusy(false);
    }
  }
  async function makeCurrentRelease(r:Release){
    if(!selected)return;
    if(!r.apk_path && !selected.download_url) return flash(false,"Release ini belum memiliki file APK.");
    if(r.is_current) return;
    if(!confirm("Jadikan v"+r.version+" sebagai release current?")) return;
    setBusy(true);
    const previous=releases.find(x=>x.is_current);
    const {error:clearError}=await supabase.from("app_releases").update({is_current:false}).eq("app_id",selected.id);
    if(clearError){flash(false,clearError.message);setBusy(false);return}
    const {error}=await supabase.from("app_releases").update({is_current:true,status:"published"}).eq("id",r.id);
    if(error){
      if(previous) await supabase.from("app_releases").update({is_current:true,status:previous.status}).eq("id",previous.id);
      flash(false,error.message);setBusy(false);return
    }
    const publicUrl=r.apk_path?.startsWith("http") ? r.apk_path : (r.apk_path ? supabase.storage.from("lara-apks").getPublicUrl(r.apk_path).data.publicUrl : null);
    const next={version:r.version,size:r.apk_size_bytes?((r.apk_size_bytes/1024/1024).toFixed(2)+" MB"):selected.size,sha256:r.sha256||selected.sha256,download_url:publicUrl||selected.download_url,updated_at:new Date().toISOString(),verified:true};
    const {error:appError}=await supabase.from("store_apps").update(next).eq("id",selected.id);
    if(appError){flash(false,appError.message);setBusy(false);return}
    const updated={...selected,...next};
    setSelected(updated);
    setForm({...form,version:next.version,size:next.size||"",sha256:next.sha256||"",download_url:next.download_url||""});
    await loadApps(); await loadDetails(selected.id);
    flash(true,"Release v"+r.version+" sekarang menjadi current.");
    setBusy(false);
  }
  async function uploadIcon(file:File){
    if(busy) return;
    if(!selected)return flash(false,"Simpan aplikasi dulu.");
    setBusy(true);
    try {
    const ext=file.name.split(".").pop()||"png"; const path=`apps/${selected.id}/icon.${ext}`;
    const {error}=await supabase.storage.from("lara-app-media").upload(path,file,{upsert:true,contentType:file.type});
    if(error){flash(false,error.message);return;}
    const {data}=supabase.storage.from("lara-app-media").getPublicUrl(path);
    const {error:dbError}=await supabase.from("store_apps").update({icon_url:data.publicUrl}).eq("id",selected.id);
    if(dbError) flash(false,dbError.message);
    else {
      const iconUrl=data.publicUrl+"?v="+Date.now();
      setSelected({...selected,icon_url:iconUrl});
      const {data:existingMedia}=await supabase.from("app_media").select("id").eq("app_id",selected.id).eq("kind","icon").limit(1);
      if(existingMedia?.length){
        const {error:mediaError}=await supabase.from("app_media").update({storage_path:path,sort_order:0}).eq("id",existingMedia[0].id);
        if(mediaError) flash(false,mediaError.message); else flash(true,"Icon berhasil diperbarui.");
      } else {
        const {error:mediaError}=await supabase.from("app_media").insert({app_id:selected.id,kind:"icon",storage_path:path,sort_order:0});
        if(mediaError) flash(false,mediaError.message); else flash(true,"Icon berhasil diunggah.");
      }
    }
    } catch(e:any) {
      flash(false,e?.message || "Gagal mengunggah icon.");
    } finally {
      setBusy(false);
    }
  }
  async function unpublish(){
    if(busy) return;
    if(!selected || selected.status!=="published") return;
    if(!confirm("Batalkan publikasi aplikasi ini?")) return;
    setBusy(true);
    const {error}=await supabase.from("store_apps").update({status:"draft",official:false,updated_at:new Date().toISOString()}).eq("id",selected.id);
    if(error) flash(false,error.message);
    else { setSelected({...selected,status:"draft",official:false}); setForm({...form,status:"draft",official:false}); await loadApps(); flash(true,"Aplikasi kembali menjadi draft."); }
    setBusy(false);
  }
  async function publish(){
    if(busy) return;
    if(!selected)return;
    if(!selected.verified) return flash(false,"Verifikasi aplikasi sebelum publish.");
    if(!releases.some(r=>r.is_current && r.status==="published") && !selected.download_url) return flash(false,"Tetapkan satu release current atau isi URL download terlebih dahulu.");
    setBusy(true);
    const {error}=await supabase.from("store_apps").update({status:"published",official:true,published_at:new Date().toISOString()}).eq("id",selected.id);
    if(error)flash(false,error.message);else{flash(true,"Aplikasi dipublikasikan sebagai Official.");await loadApps();setSelected({...selected,status:"published",official:true});}
    setBusy(false);
  }
  async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setLoginError("");const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)setLoginError(error.message);else setSession(data.session);setBusy(false)}
  async function signOut(){await supabase.auth.signOut();setSession(null)}
  const filtered=useMemo(()=>apps.filter(a=>(a.name+" "+(a.category||"")).toLowerCase().includes(query.toLowerCase())),[apps,query]);

  if(!session) return <div className="login"><div className="login-card"><div className="brand-mark">LS</div><h1>Lara Studio Admin</h1><p>Panel privat untuk mengelola aplikasi resmi Lara Studio.</p><form onSubmit={signIn}><input type="email" placeholder="Email admin" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/>{loginError&&<div className="error"><AlertCircle size={16}/>{loginError}</div>}<button className="primary wide" disabled={busy}>{busy?"Memeriksa...":"Masuk ke Admin"}</button></form><small>Hanya akun Supabase dengan <b>app_metadata.is_admin=true</b> yang dapat mengelola data.</small></div></div>;

  if(session.user?.app_metadata?.is_admin!==true) return <div className="login"><div className="login-card"><div className="brand-mark">LS</div><h1>Akses ditolak</h1><p>Akun ini belum memiliki hak Admin Lara Studio.</p><button className="primary wide" onClick={signOut}>Keluar</button></div></div>;

  return <div className="shell">
    <aside><div className="brand"><div className="brand-mark">LS</div><div><b>Lara Studio</b><span>ADMIN</span></div></div>
      <nav><button className={view==="dashboard"?"active":""} onClick={()=>setView("dashboard")}><LayoutDashboard/>Dashboard</button><button className={view==="apps"?"active":""} onClick={()=>setView("apps")}><Package/>Aplikasi</button></nav>
      <div className="side-bottom"><div className="admin-chip"><ShieldCheck size={16}/> Admin terverifikasi</div><button className="logout" onClick={signOut}><LogOut/>Keluar</button></div>
    </aside>
    <main><header><div><h2>{view==="dashboard"?"Dashboard":"Manajemen Aplikasi"}</h2><p>Kelola katalog publik tanpa menyentuh website Lara Studio.</p></div><button className="ghost" onClick={loadApps} disabled={busy}><RefreshCw size={17}/>Refresh</button></header>
      {notice&&<div className={notice.ok?"notice ok":"notice"}>{notice.ok?<CheckCircle2/>:<AlertCircle/>}{notice.text}</div>}
      {view==="dashboard" ? <Dashboard apps={apps} onNew={newApp} onSelect={(a)=>{selectApp(a);setView("apps")}}/> :
      <div className="content-grid"><section className="panel"><div className="panel-head"><div><b>Aplikasi</b><span>{apps.length} item</span></div><button className="primary" onClick={newApp}><Plus size={17}/>Tambah aplikasi</button></div><div className="search"><Search size={17}/><input placeholder="Cari aplikasi..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="app-list">{filtered.map(a=><button key={a.id} className={selected?.id===a.id?"app-row selected":"app-row"} onClick={()=>selectApp(a)}><div className="app-icon">{a.icon_url?<img src={a.icon_url}/>:<Package/>}</div><div className="app-meta"><b>{a.name}</b><span>{a.version||"—"} · {a.category||"Uncategorized"}</span></div><span className={"pill "+a.status}>{a.status}</span>{a.official&&<span className="official">OFFICIAL</span>}</button>)}</div></section>
      <section className="panel editor">{selected||creating ? <><div className="panel-head"><div><b>{selected?"Edit Aplikasi":"Aplikasi Baru"}</b><span>{selected?.id||"Belum disimpan"}</span></div>{selected&&<button className="danger" onClick={deleteApp}><Archive size={16}/></button>}</div>
        <div className="form-grid">{[["name","Nama aplikasi"],["developer","Developer / publisher"],["category","Kategori"],["version","Versi"],["size","Ukuran APK"],["android","Minimum Android"],["page_slug","Slug halaman"],["download_url","URL download"]].map(([k,l])=><label key={k}>{l}<input value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<label className="full apk-import">Pilih file APK — semua data otomatis<input type="file" accept=".apk,application/vnd.android.package-archive" onChange={e=>{const f=e.target.files?.[0];if(f)inspectApk(f);e.currentTarget.value=""}}/><small>Nama, versi, ukuran, minimum Android, SHA-256, dan icon dibaca langsung dari APK. Setelah klik Simpan, APK dan icon ikut disimpan otomatis.</small>{form.icon_url&&<img className="preview-icon" src={form.icon_url}/>}</label><label className="full">Deskripsi singkat<textarea rows={2} value={form.short_description} onChange={e=>setForm({...form,short_description:e.target.value})}/></label><label className="full">Deskripsi lengkap<textarea rows={6} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="full">SHA-256 (otomatis)<input value={form.sha256} readOnly/></label></div>
        <div className="toggles"><label><input type="checkbox" checked={selected?.official||false} disabled/> Official</label><label>Status<select value={selected?.status||"draft"} disabled><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
        <div className="actions"><button className="primary" onClick={saveApp} disabled={busy}>{busy?"Menyimpan...":"Simpan perubahan"}</button>{selected?.status==="published"
  ? <button className="ghost" onClick={unpublish} disabled={busy}>Batalkan publish</button>
  : <button className="publish" onClick={publish} disabled={busy}><ShieldCheck size={16}/>Verifikasi & Publish</button>}</div>
        {selected&&<><div className="subpanel"><div className="subhead"><b>Icon aplikasi</b><label className="upload"><Upload size={16}/>Upload icon<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)uploadIcon(f);e.currentTarget.value=""}}/></label></div>{selected.icon_url&&<img className="preview-icon" src={selected.icon_url}/>}</div>
        <div className="subpanel"><div className="subhead"><b>Fitur aplikasi</b><button className="ghost small" onClick={addFeature}><Plus size={15}/>Tambah</button></div>{features.map(f=><div className="feature-row" key={f.id}><span>{f.title}</span><button onClick={()=>removeFeature(f.id)}><X size={15}/></button></div>)}{!features.length&&<small>Belum ada fitur.</small>}</div>
        <div className="subpanel"><div className="subhead"><b>Rilis APK</b><label className="upload"><Upload size={16}/>Upload APK<input type="file" accept=".apk,application/vnd.android.package-archive" onChange={e=>{const f=e.target.files?.[0];if(f)uploadApk(f);e.currentTarget.value=""}}/></label></div>{releases.map(r=><div className="release-row" key={r.id}><div><b>v{r.version}</b><span>{r.apk_size_bytes?((r.apk_size_bytes/1024/1024).toFixed(2)+" MB"):"—"} · {r.status} · SHA {r.sha256?.slice(0,12)||"—"}…</span></div>{r.is_current?<span className="official">CURRENT</span>:r.apk_path?<button className="ghost small" onClick={()=>makeCurrentRelease(r)}>Jadikan current</button>:<span className="pill draft">EXTERNAL</span>}</div>)}{!releases.length&&<small>Belum ada release. Upload APK untuk membuat release draft dan menghitung SHA-256.</small>}</div></>}</> : <div className="empty"><Package size={40}/><b>Pilih aplikasi</b><span>Atau buat aplikasi baru untuk mulai.</span><button className="primary" onClick={newApp}><Plus size={16}/>Tambah aplikasi</button></div>}</section></div>}
    </main>
  </div>
}

function Dashboard({apps,onNew,onSelect}:{apps:AppRow[];onNew:()=>void;onSelect:(a:AppRow)=>void}){
 const published=apps.filter(a=>a.status==="published").length, official=apps.filter(a=>a.official).length, drafts=apps.filter(a=>a.status==="draft").length;
 return <div className="dash"><div className="stats"><div><Package/><span>Total aplikasi</span><b>{apps.length}</b></div><div><CheckCircle2/><span>Published</span><b>{published}</b></div><div><ShieldCheck/><span>Official</span><b>{official}</b></div><div><Pencil/><span>Draft</span><b>{drafts}</b></div></div><section className="hero-panel"><div><span className="eyebrow">LARA STUDIO CONTROL CENTER</span><h3>Kelola katalog aplikasi secara terpusat.</h3><p>Tambah aplikasi, metadata, icon, fitur, rilis, dan status publikasi dari satu panel privat.</p><button className="primary" onClick={onNew}><Plus size={17}/>Tambah aplikasi</button></div><div className="hero-art">LS</div></section><section className="panel"><div className="panel-head"><div><b>Terbaru</b><span>{apps.length} aplikasi</span></div></div>{apps.slice(0,6).map(a=><button className="app-row" key={a.id} onClick={()=>onSelect(a)}><div className="app-icon">{a.icon_url?<img src={a.icon_url}/>:<Package/>}</div><div className="app-meta"><b>{a.name}</b><span>v{a.version||"—"} · {a.category||"—"}</span></div><span className={"pill "+a.status}>{a.status}</span></button>)}</section></div>
}