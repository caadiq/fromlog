import { writeFileSync } from 'node:fs';
import { installShutdown } from '../../src/utils/shutdown.js';
const timer=setInterval(()=>{},1000);
installShutdown({ log:{info(){},error(){}},close:async()=>{await new Promise(r=>setTimeout(r,80));writeFileSync('/audit/shutdown-completed','yes');clearInterval(timer);} });
writeFileSync('/audit/shutdown-ready','yes');
