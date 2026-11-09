/** Header helpers: fungsi parser lain berada di Core_Data.gs dan dapat dipindahkan tanpa mengganti API. */
function yehCheckSourceHeaders_(name){const t=yehSourceTable_(name);return {name,headers:t.headers,rows:t.rows.length};}
