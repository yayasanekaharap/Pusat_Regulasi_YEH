/** Permanent small module: group membership management (missing in v1.1.0). */
function yehAdminMembers_(user){yehAdmin_(user);return yehObjRows_('Cfg_Anggota_Grup').map(x=>({userId:x.User_ID,groupId:x.ID_Kelompok,active:x.Aktif}));}
function yehAdminSaveMember_(user,p){
 yehAdmin_(user);const x=p.member||{}, uid=String(x.userId||''),gid=String(x.groupId||'');
 if(!yehFindObj_('Cfg_Pengguna','User_ID',uid))throw Error('Pengguna tidak ditemukan.');
 if(!yehFindObj_('Cfg_Kelompok','ID_Kelompok',gid))throw Error('Kelompok tidak ditemukan.');
 const old=yehObjRows_('Cfg_Anggota_Grup').find(r=>r.User_ID===uid&&r.ID_Kelompok===gid), active=x.active==='TIDAK'?'TIDAK':'YA';
 if(old)yehPatch_('Cfg_Anggota_Grup',old._row,{Aktif:active});
 else yehSheet_('Cfg_Anggota_Grup').appendRow([uid,gid,active]);
 yehInvalidateSessions_(uid);yehAudit_('SAVE_MEMBER',user.id,uid+':'+gid);return {saved:true};
}
