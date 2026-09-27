const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(process.env.BUILD_ROOT||'/audit/baseline');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'};
http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+'/')&&file!==root){res.writeHead(403);return res.end();}
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
 if(req.url.startsWith('/api/')){res.writeHead(503);return res.end('Mock API required');}
 const raw=fs.readFileSync(file),compress=/\.(js|css|html|svg)$/.test(file)&&req.headers['accept-encoding']?.includes('gzip');
 const data=compress?zlib.gzipSync(raw):raw;
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store',...(compress?{'Content-Encoding':'gzip'}:{})});res.end(data);
}).listen(Number(process.env.PORT||18089),'127.0.0.1');
