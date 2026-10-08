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
type Media={id:string;app_id:string;kind:string;storage_path:string;alt_text:string|null;sort_order:number};
type Release={id:string;app_id:string;version:string;version_code:number|null;apk_path:string|null;apk_size_bytes:number|null;sha256:string|null;min_android:string|null;architectures:string[]|null;release_notes:string|null;is_current:boolean;status:"draft"|"published"|"archived"};

type AppForm={name:string;category:string;short_description:string;description:string;developer:string;page_slug:string;version:string;size:string;android:string;sha256:string;download_url:string;icon_url:string;official:boolean;status:"draft"|"published"|"archived"};

const LARA_STUDIO_PUBLIC_BASE="https://lara-apk.vercel.app";
const publicAppUrl=(slug:string)=>slug?`${LARA_STUDIO_PUBLIC_BASE}/apps/app.html?app=${encodeURIComponent(slug)}`:"";
const emptyForm:AppForm={name:"",category:"Utilities",short_description:"",description:"",developer:"",page_slug:"",version:"1.0.0",size:"",android:"Android 8.0+",sha256:"",download_url:"",icon_url:"",official:false,status:"draft"};

export default function App(){
  const [session,setSession]=useState<any>(null);
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [loginError,setLoginError]=useState(""); const [busy,setBusy]=useState(false);
  const [apps,setApps]=useState<AppRow[]>([]); const [selected,setSelected]=useState<AppRow|null>(null);
  const [form,setForm]=useState(emptyForm); const [features,setFeatures]=useState<Feature[]>([]);
  const [releases,setReleases]=useState<Release[]>([]); const [media,setMedia]=useState<Media[]>([]); const [query,setQuery]=useState("");
  const [creating,setCreating]=useState(false); const [newApkFile,setNewApkFile]=useState<File|null>(null); const [newApkVersionCode,setNewApkVersionCode]=useState<number|null>(null);
  const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null); const [view,setView]=useState<"dashboard"|"apps">("dashboard");

  useEffect(()=>{ supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return()=>data.subscription.unsubscribe(); },[]);
  useEffect(()=>{ if(session && session.user?.app_metadata?.is_admin===true) loadApps(); },[session]);

  async function loadApps(){
    setBusy(true); const {data,error}=await supabase.from("store_apps").select("*").order("updated_at",{ascending:false});
    if(error) flash(false,error.message); else setApps((data||[]) as AppRow[]); setBusy(false);
  }
  function flash(ok:boolean,text:string){setNotice({ok,text});setTimeout(()=>setNotice(null),3500)}
  function selectApp(a:AppRow){setCreating(false);setNewApkFile(null);setNewApkVersionCode(null);setSelected(a);setForm({name:a.name,category:a.category||"",short_description:a.short_description||"",description:a.description||"",developer:a.developer||"",page_slug:a.page_slug||"",version:a.version||"1.0.0",size:a.size||"",android:a.android||"",sha256:a.sha256||"",download_url:publicAppUrl(a.page_slug||a.id)||"",official:a.official,status:a.status}); loadDetails(a.id);}
  async function loadDetails(id:string){
    const [f,r,m]=await Promise.all([
      supabase.from("app_features").select("*").eq("app_id",id).order("sort_order"),
      supabase.from("app_releases").select("*").eq("app_id",id).order("created_at",{ascending:false}),
      supabase.from("app_media").select("*").eq("app_id",id).order("sort_order")
    ]);
    if(f.error || r.error || m.error){ flash(false, f.error?.message || r.error?.message || m.error?.message || "Gagal memuat detail aplikasi."); return; }
    setFeatures((f.data||[]) as Feature[]);
    setReleases((r.data||[]) as Release[]); setMedia((m.data||[]) as Media[]);
  }
  function sdkName(sdk?:number){
    if(!sdk) return "Android";
    const map:Record<number,string>={21:"5.0",22:"5.1",23:"6.0",24:"7.0",25:"7.1",26:"8.0",27:"8.1",28:"9",29:"10",30:"11",31:"12",32:"12L",33:"13",34:"14",35:"15",36:"16",37:"17"};
    return "Android "+(map[sdk]||("API "+sdk))+"+";
  }
  function buildApkDescriptions(meta:any,name:string,version:string,minSdk:number,file:File){
    const pkg=String(meta?.packageName||meta?.application?.packageName||"").trim();
    const permissionsRaw=meta?.usesPermissions||meta?.permissions||meta?.usesPermission||[];
    const permissions=Array.isArray(permissionsRaw)?permissionsRaw.map((p:any)=>String(p?.name||p||"").toUpperCase()):[];
    const capabilityMap:[string,string][]=[
      ["CAMERA","kamera"],["RECORD_AUDIO","mikrofon/audio"],["ACCESS_FINE_LOCATION","lokasi"],
      ["ACCESS_COARSE_LOCATION","lokasi"],["READ_CONTACTS","kontak"],["READ_MEDIA_IMAGES","gambar/media"],
      ["READ_EXTERNAL_STORAGE","penyimpanan perangkat"],["WRITE_EXTERNAL_STORAGE","penyimpanan perangkat"],
      ["INTERNET","akses internet"],["BLUETOOTH","Bluetooth"],["BLUETOOTH_CONNECT","Bluetooth"],
      ["POST_NOTIFICATIONS","notifikasi"]
    ];
    const capabilities=Array.from(new Set(capabilityMap.filter(([key])=>permissions.some(p=>p.includes(key))).map(([,label])=>label)));
    const capabilityText=capabilities.length?" APK ini meminta akses terkait "+capabilities.join(", ")+".":"";
    const packageText=pkg?" Package Android: "+pkg+".":"";
    const size=(file.size/1024/1024).toFixed(2)+" MB";
    const short=name+" adalah aplikasi Android yang terdeteksi otomatis dari file APK yang kamu masukkan. Versi "+version+", ukuran "+size+", dengan minimum "+sdkName(minSdk)+"."+capabilityText;
    const full=name+" merupakan aplikasi Android yang sedang dikelola melalui Lara Studio. Metadata dasar dibaca langsung dari APK sehingga informasi halaman tetap mengikuti file yang diunggah. Versi yang terdeteksi: "+version+"; ukuran APK: "+size+"; minimum Android: "+sdkName(minSdk)+"."+packageText+capabilityText+" Deskripsi ini dibuat otomatis dari metadata APK dan dapat kamu sesuaikan sebelum aplikasi dipublikasikan.";
    return {short,full};
  }

  async function inspectApk(file:File){
    if(!file.name.toLowerCase().endsWith(".apk")) return flash(false,"File harus APK.");
    setBusy(true);
    try{
      const buffer=await file.arrayBuffer();
      const Parser=(window as any).AppInfoParser;
      if(!Parser) throw new Error("Parser APK belum tersedia. Muat ulang halaman Admin.");
      const meta:any=await new Parser(file).parse();
      const hash=await crypto.subtle.digest("SHA-256",buffer);
      const sha=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
      let iconUrl="";
      if(typeof meta?.icon==="string" && meta.icon.startsWith("data:image/")) iconUrl=meta.icon;
      const version=String(meta?.versionName||meta?.version||"1.0.0");
      const rawName=meta?.application?.label ?? meta?.label ?? meta?.packageName ?? file.name.replace(/\\.apk$/i,"");
      const name=String(rawName);
      const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      const minSdk=Number(meta?.minSdkVersion||meta?.minSdk||meta?.usesSdk?.minSdkVersion||0);
      const descriptions=buildApkDescriptions(meta,name,version,minSdk,file);
      setNewApkFile(file); setNewApkVersionCode(Number(meta?.versionCode)||null);
      setForm(x=>{const pageSlug=x.page_slug||slug;return {...x,name,version,size:(file.size/1024/1024).toFixed(2)+" MB",android:sdkName(minSdk),sha256:sha,page_slug:pageSlug,download_url:publicAppUrl(pageSlug),icon_url:iconUrl,short_description:descriptions.short,description:descriptions.full};});
      flash(true,iconUrl?"APK terbaca lengkap: metadata, SHA-256, dan icon otomatis.":"APK terbaca: metadata dan SHA-256 otomatis.");
    }catch(e:any){ flash(false,e?.message||"APK tidak dapat dibaca. Pastikan file APK valid."); }
    finally{ setBusy(false); }
  }
  function newApp(){
    setSelected(null);
    setForm({...emptyForm});
    setFeatures([]);
    setReleases([]);
    setNewApkFile(null);
    setCreating(true);
    setView("apps");
  }
  async function persistNewApk(app:AppRow,file:File,version:string,versionCode:number|null,sha:string){
    const path="apps/"+app.id+"/"+version+"/"+file.name;
    const {error:uploadError}=await supabase.storage.from("lara-apks").upload(path,file,{upsert:true,contentType:"application/vnd.android.package-archive"});
    if(uploadError) throw uploadError;
    const {data:urlData}=supabase.storage.from("lara-apks").getPublicUrl(path);
    const {data:release,error:releaseError}=await supabase.from("app_releases").insert({app_id:app.id,version,version_code:versionCode,apk_path:path,apk_size_bytes:file.size,sha256:sha,min_android:app.android,release_notes:"",is_current:true,status:"draft"}).select().single();
    if(releaseError) throw releaseError;
    let iconUrl=app.icon_url;
    if(form.icon_url){
      const iconBlob=await (await fetch(form.icon_url)).blob();
      const iconPath="apps/"+app.id+"/icon.png";
      const {error:iconError}=await supabase.storage.from("lara-app-media").upload(iconPath,iconBlob,{upsert:true,contentType:iconBlob.type||"image/png"});
      if(iconError) throw iconError;
      iconUrl=supabase.storage.from("lara-app-media").getPublicUrl(iconPath).data.publicUrl;
      const {data:media}=await supabase.from("app_media").select("id").eq("app_id",app.id).eq("kind","icon").limit(1);
      if(media?.length) await supabase.from("app_media").update({storage_path:iconPath,sort_order:0}).eq("id",media[0].id);
      else await supabase.from("app_media").insert({app_id:app.id,kind:"icon",storage_path:iconPath,sort_order:0});
      await supabase.from("store_apps").update({icon_url:iconUrl}).eq("id",app.id);
    }
    const {error:appUpdateError}=await supabase.from("store_apps").update({download_url:publicAppUrl(app.page_slug||app.id),icon_url:iconUrl,verified:true,version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,updated_at:new Date().toISOString()}).eq("id",app.id);
    if(appUpdateError) throw appUpdateError;
    const next={...app,download_url:publicAppUrl(app.page_slug||app.id),icon_url:iconUrl,verified:true,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha};
    setSelected(next); setForm(x=>({...x,download_url:publicAppUrl(app.page_slug||app.id),icon_url:iconUrl,size:next.size||"",sha256:sha})); setReleases([release as Release]);
    return next;
  }
  async function saveApp(){
    if(busy) return;
    const isNew=!selected;
    if(isNew && !newApkFile) return flash(false,"Pilih file APK terlebih dahulu.");
    if(!form.name.trim()) return flash(false,"Nama aplikasi wajib diisi.");
    setBusy(true);
    try{
      const slug=form.page_slug.trim()||form.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      if(!slug) throw new Error("Slug aplikasi tidak valid.");
      const appId=isNew?slug:selected!.id;
      const payload={id:appId,name:form.name.trim(),category:form.category.trim()||"Utilities",short_description:form.short_description.trim()||null,description:form.description.trim()||null,developer:form.developer.trim()||"Lara Studio",page_slug:slug,version:form.version.trim()||"1.0.0",size:form.size.trim()||null,android:form.android.trim()||null,sha256:form.sha256.trim()||null,download_url:publicAppUrl(slug)||"",icon_url:form.icon_url.trim()||null,official:false,status:"draft",published_at:null,updated_at:new Date().toISOString()};
      const q=selected?supabase.from("store_apps").update(payload).eq("id",selected.id).select().single():supabase.from("store_apps").insert(payload).select().single();
      const {data,error}=await q; if(error) throw error;
      let saved=data as AppRow;
      if(isNew && newApkFile) saved=await persistNewApk(saved,newApkFile,form.version.trim()||"1.0.0",newApkVersionCode,form.sha256);
      setSelected(saved); setCreating(false); setNewApkFile(null); setNewApkVersionCode(null);
      await loadApps(); await loadDetails(saved.id);
      flash(true,isNew?"Aplikasi berhasil ditambahkan. APK, metadata, SHA-256, dan icon tersimpan otomatis.":"Aplikasi berhasil diperbarui.");
    }catch(e:any){
      if(isNew) await supabase.from("store_apps").delete().eq("id",slugForRollback(form));
      flash(false,e?.message||"Gagal menyimpan aplikasi.");
    }finally{setBusy(false);}
  }
  function slugForRollback(x:AppForm){ return x.page_slug.trim()||x.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
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
  async function editFeature(f:Feature){
    if(busy) return;
    const title=prompt("Nama fitur:",f.title);
    if(title===null || !title.trim()) return;
    const description=prompt("Deskripsi fitur:",f.description||"");
    setBusy(true);
    try{
      const {data,error}=await supabase.from("app_features").update({title:title.trim(),description:description?.trim()||null}).eq("id",f.id).select().single();
      if(error) throw error;
      setFeatures(prev=>prev.map(x=>x.id===f.id?data as Feature:x));
      flash(true,"Fitur berhasil diperbarui.");
    }catch(e:any){ flash(false,e?.message||"Gagal memperbarui fitur."); }
    finally{ setBusy(false); }
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
    const {error:appError}=await supabase.from("store_apps").update({version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,download_url:publicAppUrl(selected.page_slug||selected.id),verified:true,updated_at:new Date().toISOString()}).eq("id",selected.id);
    if(appError){
      await supabase.from("app_releases").delete().eq("id",data?.id);
      flash(false,appError.message);return
    }
    if(data) setReleases([data as Release,...releases]);
    setSelected({...selected,version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,download_url:publicAppUrl(selected.page_slug||selected.id),verified:true});
    setForm({...form,version,size:(file.size/1024/1024).toFixed(2)+" MB",sha256:sha,download_url:publicAppUrl(selected.page_slug||selected.id)});
    flash(true,"APK diunggah dan SHA-256 dihitung. Release masih draft.");
    } catch(e:any) {
      flash(false,e?.message || "Gagal memproses APK.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteRelease(r:Release){
    if(!selected) return;
    if(r.is_current) return flash(false,"Release current tidak bisa dihapus. Jadikan release lain sebagai current terlebih dahulu.");
    if(!confirm("Hapus APK v"+r.version+" yang belum dipublikasikan? File APK dan data release ini akan dihapus permanen.")) return;
    setBusy(true);
    try{
      if(r.apk_path){
        const {error:storageError}=await supabase.storage.from("lara-apks").remove([r.apk_path]);
        if(storageError) throw storageError;
      }
      const {error}=await supabase.from("app_releases").delete().eq("id",r.id).eq("app_id",selected.id);
      if(error) throw error;
      setReleases(releases.filter(x=>x.id!==r.id));
      flash(true,"APK v"+r.version+" berhasil dihapus karena tidak jadi dipublikasikan.");
    }catch(e:any){
      flash(false,e?.message||"Gagal menghapus APK release.");
    }finally{
      setBusy(false);
    }
  }
  async function makeCurrentRelease(r:Release){
    if(!selected)return;
    if(!r.apk_path) return flash(false,"Release ini belum memiliki file APK.");
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
    const publicUrl=r.apk_path ? supabase.storage.from("lara-apks").getPublicUrl(r.apk_path).data.publicUrl : null;
    const next={version:r.version,size:r.apk_size_bytes?((r.apk_size_bytes/1024/1024).toFixed(2)+" MB"):selected.size,sha256:r.sha256||selected.sha256,download_url:publicAppUrl(selected.page_slug||selected.id)||selected.download_url,updated_at:new Date().toISOString(),verified:true};
    const {error:appError}=await supabase.from("store_apps").update(next).eq("id",selected.id);
    if(appError){flash(false,appError.message);setBusy(false);return}
    const updated={...selected,...next,verified:true};
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
  async function uploadMedia(files:FileList|null){
    if(busy) return;
    if(!selected) return flash(false,"Simpan aplikasi dulu.");
    const list=Array.from(files||[]).filter(f=>f.type.startsWith("image/"));
    if(!list.length) return flash(false,"Pilih gambar screenshot terlebih dahulu.");
    setBusy(true);
    try{
      let order=media.filter(x=>x.kind==="screenshot").length+1;
      for(const file of list){
        const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
        const path="apps/"+selected.id+"/screenshots/"+Date.now()+"-"+order+"."+ext;
        const {error:upError}=await supabase.storage.from("lara-app-media").upload(path,file,{upsert:true,contentType:file.type});
        if(upError) throw upError;
        const {data,error:dbError}=await supabase.from("app_media").insert({app_id:selected.id,kind:"screenshot",storage_path:path,alt_text:selected.name+" screenshot "+order,sort_order:order}).select().single();
        if(dbError) throw dbError;
        setMedia(prev=>[...prev,db as Media]); order++;
      }
      flash(true,list.length+" screenshot berhasil ditambahkan.");
    }catch(e:any){ flash(false,e?.message||"Gagal mengunggah screenshot."); }
    finally{ setBusy(false); }
  }
  async function editMedia(item:Media){
    if(busy || !selected || item.kind!=="screenshot") return;
    const alt=prompt("Nama/deskripsi screenshot:",item.alt_text||"");
    if(alt===null) return;
    setBusy(true);
    try{
      const {error}=await supabase.from("app_media").update({alt_text:alt.trim()||null}).eq("id",item.id).eq("app_id",selected.id);
      if(error) throw error;
      setMedia(prev=>prev.map(x=>x.id===item.id?{...x,alt_text:alt.trim()||null}:x));
      flash(true,"Screenshot berhasil diperbarui.");
    }catch(e:any){ flash(false,e?.message||"Gagal memperbarui screenshot."); }
    finally{ setBusy(false); }
  }
  async function removeMedia(item:Media){
    if(busy || !selected || item.kind!=="screenshot") return;
    if(!confirm("Hapus screenshot ini?")) return;
    setBusy(true);
    try{
      const {error:storageError}=await supabase.storage.from("lara-app-media").remove([item.storage_path]);
      if(storageError) throw storageError;
      const {error}=await supabase.from("app_media").delete().eq("id",item.id).eq("app_id",selected.id);
      if(error) throw error;
      setMedia(prev=>prev.filter(x=>x.id!==item.id));
      flash(true,"Screenshot dihapus.");
    }catch(e:any){ flash(false,e?.message||"Gagal menghapus screenshot."); }
    finally{ setBusy(false); }
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
    const currentRelease=releases.find(r=>r.is_current);
    if(!currentRelease || !currentRelease.apk_path) return flash(false,"Tetapkan release current yang memiliki file APK terlebih dahulu.");
    if(!selected.verified){
      const expectedUrl=publicAppUrl(selected.page_slug||selected.id);
      const {error:verifyError}=await supabase.from("store_apps").update({
        verified:true,
        download_url:expectedUrl,
        updated_at:new Date().toISOString()
      }).eq("id",selected.id);
      if(verifyError) return flash(false,"Verifikasi APK gagal: "+verifyError.message);
      setSelected({...selected,verified:true,download_url:expectedUrl});
    }
    setBusy(true);
    let promoted=false;
    try{
      if(currentRelease && currentRelease.status!=="published"){
        const {error:releaseError}=await supabase.from("app_releases").update({status:"published"}).eq("id",currentRelease.id);
        if(releaseError) throw releaseError;
        promoted=true;
      }
      const publicUrl=publicAppUrl(selected.page_slug||selected.id);
      const {error}=await supabase.from("store_apps").update({status:"published",official:true,verified:true,download_url:publicUrl,published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",selected.id);
      if(error) throw error;
      await loadApps(); await loadDetails(selected.id);
      setSelected({...selected,status:"published",official:true});
      setForm({...form,status:"published",official:true});
      flash(true,"Aplikasi dipublikasikan sebagai Official beserta release current.");
    }catch(e:any){
      if(promoted && currentRelease) await supabase.from("app_releases").update({status:currentRelease.status}).eq("id",currentRelease.id);
      flash(false,e?.message||"Gagal mempublikasikan aplikasi.");
    }finally{setBusy(false);}
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
      <div className="content-grid"><section className="panel"><div className="panel-head"><div><b>Aplikasi</b><span>{apps.length} item</span></div><button type="button" className="primary" onClick={newApp}><Plus size={17}/>Tambah aplikasi</button></div><div className="search"><Search size={17}/><input placeholder="Cari aplikasi..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="app-list">{filtered.map(a=><button key={a.id} className={selected?.id===a.id?"app-row selected":"app-row"} onClick={()=>selectApp(a)}><div className="app-icon">{a.icon_url?<img src={a.icon_url}/>:<Package/>}</div><div className="app-meta"><b>{a.name}</b><span>{a.version||"—"} · {a.category||"Uncategorized"}</span></div><span className={"pill "+a.status}>{a.status}</span>{a.official&&<span className="official">OFFICIAL</span>}</button>)}</div></section>
      <section className="panel editor">{selected||creating ? <><div className="panel-head"><div><b>{selected?"Edit Aplikasi":"Aplikasi Baru"}</b><span>{selected?.id||"Belum disimpan"}</span></div>{selected&&<button className="danger" onClick={deleteApp}><Archive size={16}/></button>}</div>
        <div className="form-grid"><label className="full">Pilih file APK — metadata otomatis<label className="upload primary" style={{width:"fit-content"}}><Upload size={16}/>Pilih APK<input id="new-apk-input" type="file" accept=".apk,application/vnd.android.package-archive" onChange={e=>{const f=e.target.files?.[0];if(f)inspectApk(f);e.currentTarget.value=""}}/></label><small>Nama, versi, ukuran, minimum Android, SHA-256, dan icon dibaca langsung dari APK.</small>{form.icon_url&&<img className="preview-icon" src={form.icon_url}/>} </label>{[["name","Nama aplikasi"],["developer","Developer / publisher"],["category","Kategori"],["version","Versi"],["size","Ukuran APK"],["android","Minimum Android"],["page_slug","Slug halaman"]].map(([k,l])=><label key={k}>{l}<input value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}
        <label className="full">Halaman Publik Lara Studio<input value={publicAppUrl(form.page_slug.trim())} readOnly/></label><label className="full">Deskripsi singkat<textarea rows={2} value={form.short_description} onChange={e=>setForm({...form,short_description:e.target.value})}/></label><label className="full">Deskripsi lengkap<textarea rows={6} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="full">SHA-256<input value={form.sha256} onChange={e=>setForm({...form,sha256:e.target.value})}/></label></div>
        <div className="toggles"><label><input type="checkbox" checked={selected?.official||false} disabled/> Official</label><label>Status<select value={selected?.status||"draft"} disabled><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
        <div className="actions"><button className="primary" onClick={saveApp} disabled={busy}>{busy?"Menyimpan...":creating?"Simpan aplikasi":"Simpan perubahan"}</button>{selected?.status==="published"
  ? <button className="ghost" onClick={unpublish} disabled={busy}>Batalkan publish</button>
  : <button className="publish" onClick={publish} disabled={busy}><ShieldCheck size={16}/>Verifikasi & Publish</button>}</div>
        {selected&&<><div className="subpanel"><div className="subhead"><b>Icon aplikasi</b><label className="upload"><Upload size={16}/>Upload icon<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)uploadIcon(f);e.currentTarget.value=""}}/></label></div>{selected.icon_url&&<img className="preview-icon" src={selected.icon_url}/>}</div>
        <div className="subpanel">
          <div className="subhead">
            <b>Screenshot aplikasi</b>
            <label className="upload"><Upload size={16}/>Upload screenshot<input type="file" accept="image/*" multiple onChange={e=>{uploadMedia(e.target.files);e.currentTarget.value=""}}/></label>
          </div>
          {media.filter(x=>x.kind==="screenshot").length
            ? <div className="media-grid">{media.filter(x=>x.kind==="screenshot").map(x=><div className="media-card" key={x.id}><img src={supabase.storage.from("lara-app-media").getPublicUrl(x.storage_path).data.publicUrl} alt={x.alt_text||"Screenshot"}/><div className="media-actions"><button className="ghost small" onClick={()=>editMedia(x)} disabled={busy}><Pencil size={14}/>Edit</button><button className="danger small" onClick={()=>removeMedia(x)} disabled={busy}><X size={14}/>Hapus</button></div></div>)}</div>
            : <small>Belum ada screenshot. Jika otomatis belum tersedia, upload beberapa screenshot sekaligus di sini.</small>}
        </div>
        <div className="subpanel"><div className="subhead"><b>Fitur aplikasi</b><button className="ghost small" onClick={addFeature}><Plus size={15}/>Tambah</button></div>{features.map(f=><div className="feature-row" key={f.id}><div><b>{f.title}</b>{f.description&&<small>{f.description}</small>}</div><div className="row-actions"><button className="ghost small" onClick={()=>editFeature(f)} disabled={busy}><Pencil size={14}/>Edit</button><button className="danger small" onClick={()=>removeFeature(f.id)} disabled={busy}><X size={14}/>Hapus</button></div></div>)}{!features.length&&<small>Belum ada fitur.</small>}</div>
        <div className="subpanel"><div className="subhead"><b>Rilis APK</b><label className="upload"><Upload size={16}/>Upload APK<input type="file" accept=".apk,application/vnd.android.package-archive" onChange={e=>{const f=e.target.files?.[0];if(f)uploadApk(f);e.currentTarget.value=""}}/></label></div>{releases.map(r=><div className="release-row" key={r.id}><div><b>v{r.version}</b><span>{r.apk_size_bytes?((r.apk_size_bytes/1024/1024).toFixed(2)+" MB"):"—"} · {r.status} · SHA {r.sha256?.slice(0,12)||"—"}…</span></div>{r.is_current?<span className="official">CURRENT</span>:<div style={{display:"flex",gap:8,alignItems:"center"}}><button className="ghost small" onClick={()=>makeCurrentRelease(r)}>Jadikan current</button><button className="danger small" onClick={()=>deleteRelease(r)} disabled={busy}>Hapus</button></div>}</div>)}{!releases.length&&<small>Belum ada release. Upload APK untuk membuat release draft dan menghitung SHA-256.</small>}</div></>}</> : <div className="empty"><Package size={40}/><b>Pilih aplikasi</b><span>Atau buat aplikasi baru untuk mulai.</span><button className="primary" onClick={newApp}><Plus size={16}/>Tambah aplikasi</button></div>}</section></div>}
    </main>
  </div>
}

function Dashboard({apps,onNew,onSelect}:{apps:AppRow[];onNew:()=>void;onSelect:(a:AppRow)=>void}){
 const published=apps.filter(a=>a.status==="published").length, official=apps.filter(a=>a.official).length, drafts=apps.filter(a=>a.status==="draft").length;
 return <div className="dash"><div className="stats"><div><Package/><span>Total aplikasi</span><b>{apps.length}</b></div><div><CheckCircle2/><span>Published</span><b>{published}</b></div><div><ShieldCheck/><span>Official</span><b>{official}</b></div><div><Pencil/><span>Draft</span><b>{drafts}</b></div></div><section className="hero-panel"><div><span className="eyebrow">LARA STUDIO CONTROL CENTER</span><h3>Kelola katalog aplikasi secara terpusat.</h3><p>Tambah aplikasi, metadata, icon, fitur, rilis, dan status publikasi dari satu panel privat.</p><button className="primary" onClick={onNew}><Plus size={17}/>Tambah aplikasi</button></div><div className="hero-art">LS</div></section><section className="panel"><div className="panel-head"><div><b>Terbaru</b><span>{apps.length} aplikasi</span></div></div>{apps.slice(0,6).map(a=><button className="app-row" key={a.id} onClick={()=>onSelect(a)}><div className="app-icon">{a.icon_url?<img src={a.icon_url}/>:<Package/>}</div><div className="app-meta"><b>{a.name}</b><span>v{a.version||"—"} · {a.category||"—"}</span></div><span className={"pill "+a.status}>{a.status}</span></button>)}</section></div>
}