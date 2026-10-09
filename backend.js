/* SL Connect - cloud backend (Supabase).
   Only active when SUPABASE_URL and SUPABASE_ANON_KEY are filled in config.js.
   Without them the app runs in demo mode (data saved on the phone only). */
const CLOUD_ON=typeof SUPABASE_URL!=="undefined"&&!!SUPABASE_URL&&!!SUPABASE_ANON_KEY;
const CLOUD=CLOUD_ON&&typeof supabase!=="undefined";
const sb=CLOUD?supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const fromRow=r=>({id:r.id,type:r.type,title:r.title,cat:r.cat||"",loc:r.loc,price:r.price||"",phone:r.phone||"",desc:r.descr||"",images:r.images||[],status:r.status,owner:r.owner,by:r.by_name||"Member",at:r.created_at});
const CB={
  msg(e){const m=(e&&e.message)||"";
    if(/invalid login/i.test(m))return"Wrong email or password.";
    if(/already registered|already exists/i.test(m))return"This email already has an account. Sign in instead.";
    if(/not confirmed/i.test(m))return"Please confirm your email first. Check your inbox.";
    if(/rate limit|too many/i.test(m))return"Too many tries. Please wait a few minutes.";
    if(/fetch|network/i.test(m))return"No internet connection.";
    return m||"Something went wrong. Try again."},
  async uid(){const{data}=await sb.auth.getSession();if(!data.session)throw new Error("Please sign in again.");return data.session.user.id},
  async loadUser(u){
    const[p,f,a]=await Promise.all([
      sb.from("profiles").select("name,phone").eq("id",u.id).maybeSingle(),
      sb.from("favorites").select("post_id").eq("user_id",u.id),
      sb.from("admins").select("user_id").eq("user_id",u.id).maybeSingle()]);
    const md=u.user_metadata||{};
    return{id:u.id,email:u.email,name:(p.data&&p.data.name)||md.name||u.email.split("@")[0],phone:(p.data&&p.data.phone)||md.phone||"",favs:(f.data||[]).map(r=>r.post_id),admin:!!a.data}},
  async init(onRecovery){
    sb.auth.onAuthStateChange(ev=>{if(ev==="PASSWORD_RECOVERY")onRecovery()});
    const{data}=await sb.auth.getSession();
    return data.session?await this.loadUser(data.session.user):null},
  async signUp({name,email,phone,password}){
    const{data,error}=await sb.auth.signUp({email:email.toLowerCase(),password,options:{data:{name,phone},emailRedirectTo:location.origin+location.pathname}});
    if(error)throw error;
    if(data.user&&data.user.identities&&data.user.identities.length===0)throw new Error("User already registered");
    if(!data.session)return{needsConfirm:true};
    return{user:await this.loadUser(data.user)}},
  async signIn(email,password){
    const{data,error}=await sb.auth.signInWithPassword({email:email.toLowerCase(),password});
    if(error)throw error;return this.loadUser(data.user)},
  signOut(){return sb.auth.signOut()},
  async reset(email){const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error},
  async setPassword(pw){const{error}=await sb.auth.updateUser({password:pw});if(error)throw error},
  async posts(){const{data,error}=await sb.from("posts").select("*").order("created_at",{ascending:false}).limit(500);if(error)throw error;return data.map(fromRow)},
  async upload(dataUrl,folder){
    const blob=await(await fetch(dataUrl)).blob();
    const path=`${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
    const{error}=await sb.storage.from("post-images").upload(path,blob,{contentType:"image/jpeg",cacheControl:"31536000"});
    if(error)throw error;
    return sb.storage.from("post-images").getPublicUrl(path).data.publicUrl},
  async addPost(p){
    const urls=[];for(const d of p.images)urls.push(await this.upload(d,p.owner));
    const{data,error}=await sb.from("posts").insert({owner:p.owner,type:p.type,title:p.title,cat:p.cat,loc:p.loc,price:p.price,phone:p.phone,descr:p.desc,images:urls,status:"open"}).select().single();
    if(error)throw error;return fromRow(data)},
  async setStatus(id,status){const{error}=await sb.from("posts").update({status}).eq("id",id);if(error)throw error},
  async remove(id){const{error}=await sb.from("posts").delete().eq("id",id);if(error)throw error},
  async fav(id,on){const uid=await this.uid();
    const r=on?await sb.from("favorites").upsert({user_id:uid,post_id:id}):await sb.from("favorites").delete().eq("user_id",uid).eq("post_id",id);
    if(r.error)throw r.error},
  async report(id){const uid=await this.uid();const{error}=await sb.from("reports").insert({post_id:id,reporter:uid});if(error)throw error},
  async reports(){const{data,error}=await sb.from("reports").select("id,post_id,reason,created_at,posts(title,loc)").order("created_at",{ascending:false});if(error)throw error;return data},
  async dismiss(id){const{error}=await sb.from("reports").delete().eq("id",id);if(error)throw error},
  async counts(){const{data}=await sb.rpc("public_counts");return Object.fromEntries((data||[]).map(r=>[r.kind,Number(r.n)]))},
  async founderPhoto(){const{data}=await sb.from("site_settings").select("value").eq("key","founder_photo").maybeSingle();return(data&&data.value)||""},
  async setFounderPhoto(d){const url=await this.upload(d,"site");const{error}=await sb.from("site_settings").upsert({key:"founder_photo",value:url});if(error)throw error}
};
