//RUN {==  & "C:\Program Files\k6\k6.exe" run .\tools\testK6.js == }
// import http from 'k6/http';
// export const options = {
//     stages: [
//         { duration: '30s', target: 50 },
//         { duration: '60s', target: 200 },   
//         { duration: '30s', target: 500 },   
//         { duration: '30s', target: 0 },
//     ],
// };
// export default function () {
//     http.get('https://nvltxoxlwhoyiwdwopce.supabase.co/rest/v1/news?select=id,title,date&limit=20',
//         { headers: { 
// apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52bHR4b3hsd2hveWl3ZHdvcGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1OTEzMTgsImV4cCI6MjEwMzE2NzMxOH0.GxOjYTOpbwpSBOblRSq5Cm9sN1xd8T6Pg_Stg20dNgo'
//  } });
// }

import http from 'k6/http';
import { check } from 'k6';

// 🔑 حط الـ anon key الحقيقي بتاعك هنا
const ANON_KEY = 'YOUR_ANON_KEY_HERE';
const URL = 'https://nvltxoxlwhoyiwdwopce.supabase.co/rest/v1/rpc/get_app_bundle';

export const options = {
    stages: [
        { duration: '30s', target: 50 },
        { duration: '60s', target: 200 },   // ذروة امتحان مفتوح
        { duration: '30s', target: 500 },   // أسوأ سيناريو
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],      // فشل أقل من 1%
        http_req_duration: ['p(95)<1500'],   // 95% من الطلبات تحت 1.5 ثانية
    },
};

export default function () {
    const res = http.post(
        URL,
        JSON.stringify({ p_private: false }),   // محاكاة زائر بيحمّل الصفحة كاملة
        {
            headers: {
                apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52bHR4b3hsd2hveWl3ZHdvcGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1OTEzMTgsImV4cCI6MjEwMzE2NzMxOH0.GxOjYTOpbwpSBOblRSq5Cm9sN1xd8T6Pg_Stg20dNgo',
                'Content-Type': 'application/json',
            },
        }
    );
    check(res, { 'bundle 200': (r) => r.status === 200 });
}