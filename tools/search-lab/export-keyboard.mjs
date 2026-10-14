// Run via stdin inside the backend container with LAB_CASES containing cases.json.
import Inko from 'inko';
const inko = new Inko();
const queries = JSON.parse(process.env.LAB_CASES).map(c => c.q)
  .filter(q => /[a-zA-Z]/.test(q) && !/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(q));
console.log(JSON.stringify(Object.fromEntries(queries.map(q => [q, inko.en2ko(q)]))));
