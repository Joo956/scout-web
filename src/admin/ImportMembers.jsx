import { useState, useRef } from 'react';

// ExcelJS بيتحمّل عند الطلب بس — بيقلل حجم التحميل الأولي للكل
const loadExcel = () => import("exceljs").then((m) => m.default);
import { useStore } from '../store.jsx';
import { MemberAccountsSummary } from './ui.jsx';
import { generateTempPassword } from "../utils/generateTempPassword.js";
import { stagePasswordFor } from "../utils/stagePasswords.js";
import { stageGenderFromRaw, STAGE_PAIRS } from '../utils/stages.js';
import { supabase } from '../lib/supabaseClient.js';
import { sendCredentialsEmail } from '../utils/sendCredentialsEmail.js';

// المرحلة بتنسخ من الملف بنسختها الصح: مذكر يبقى "جوال"، مؤنث تبقى "جوالة"
const STAGES_MALE = Object.fromEntries(STAGE_PAIRS.map((p) => [p.key, p.male]));
const STAGES_FEMALE = Object.fromEntries(STAGE_PAIRS.map((p) => [p.key, p.female]));

// ✅ أعمدة قالب الاستيراد — بنفس أسماء الأعمدة اللي المحرك بيقراها حرفياً
const TEMPLATE_COLUMNS = [
    { header: 'المرحلة', width: 14 },
    { header: 'رقم', width: 10 },
    { header: 'الاسم', width: 32 },
    { header: 'الكلية', width: 20 },
    { header: 'السنة الدراسية', width: 16 },
    { header: 'المنطقة', width: 14 },
    { header: 'تاريخ الميلاد', width: 14 },
    { header: 'أب الاعتراف', width: 24 },
    { header: 'اسم الأم', width: 24 },
    { header: 'ت. الأب', width: 15 },
    { header: 'ت. الأم', width: 15 },
    { header: 'العنوان', width: 30 },
    { header: 'الموبايل 1', width: 15 },
    { header: 'الموبايل 2', width: 15 },
    { header: 'الموبايل 3', width: 15 },
    { header: 'البريد الإلكتروني', width: 28 },
];

// القيم المسموحة لعمود المرحلة (مذكر / مؤنث)
const STAGE_VALUES = STAGE_PAIRS.flatMap((p) => [p.male, p.female]);

// ✅ توليد وتنزيل قالب Excel جاهز للملء
const downloadImportTemplate = async () => {
    const ExcelJS = await loadExcel();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'منصة المجموعة';

    // ===== شيت الأعضاء (شيت الملء) =====
    const ws = wb.addWorksheet('الأعضاء', {
        views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = TEMPLATE_COLUMNS;

    // ترويسة ملونة
    const headerRow = ws.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D15' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFD6CFC5' } } };
    });

    // قائمة منسدلة لعمود المرحلة (أول 1000 صف)
    for (let r = 2; r <= 1000; r++) {
        ws.getCell(`A${r}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${STAGE_VALUES.join(',')}"`],
            showErrorMessage: true,
            errorTitle: 'مرحلة غير صحيحة',
            error: 'اختار من القائمة: ' + STAGE_VALUES.join('، '),
        };
        ws.getCell(`A${r}`).alignment = { horizontal: 'center' };
        // تاريخ الميلاد بصيغة تاريخ
        ws.getCell(`G${r}`).numFmt = 'dd/mm/yyyy';
    }

    // ===== شيت التعليمات =====
    const guide = wb.addWorksheet('طريقة الاستخدام');
    guide.columns = [{ width: 3 }, { width: 110 }];
    guide.getColumn(2).font = { size: 11, color: { argb: 'FF292524' } };
    const guideLines = [
        '📋 طريقة ملء الملف:',
        '',
        '1️⃣  املأ بيانات الأعضاء في شيت "الأعضاء" — صف واحد لكل عضو، وابدأ من الصف التاني (بعد الترويسة).',
        '2️⃣  عمود "المرحلة" — اختار من القائمة المنسدلة: ' + STAGE_VALUES.join('، '),
        '     (مذكر يبقى: أشبال / كشاف / متقدم / جوال / قائد / رائد — ومؤنث: زهرات / مرشدات / رائدات / جوالة / قائدة / رائدة)',
        '3️⃣  عمود "تاريخ الميلاد" — اكتبه بتاريخ حقيقي بصيغة يوم/شهر/سنة (مثال: 15/3/2009).',
        '4️⃣  عمود "رقم" — رقم الكشاف (اختياري).',
        '5️⃣  عمود "البريد الإلكتروني" — مهم جداً: بيتعمل منه حساب دخول تلقائي وباسورد فريد بيتبعت على الإيميل ده.',
        '6️⃣  "الموبايل 1" غالباً رقم المنزل وبيتم تجاهله في الحسابات — المهم: "ت. الأب" و "ت. الأم".',
        '7️⃣  عدد الإخوات بيتحسب تلقائياً من الأخوات المسجلين بنفس البيت — مش محتاج تكتبه.',
        '',
        '⚠️  اعمل الرفع من نفس الملف بعد الحفظ بصيغة xlsx.',
        '👀 شوف شيت "مثال" عشان تشوف شكل الصف المملوء صح.',
    ];
    guideLines.forEach((line, i) => {
        const row = guide.getRow(i + 1);
        row.getCell(2).value = line;
        if (i === 0) row.getCell(2).font = { bold: true, size: 14, color: { argb: 'FF4C1D15' } };
    });

    // ===== شيت المثال =====
    const example = wb.addWorksheet('مثال');
    example.columns = TEMPLATE_COLUMNS;
    example.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D15' } };
        cell.alignment = { horizontal: 'center' };
    });
    // المصفوفات بترتيب الأعمدة بالظبط (addRow بالمفاتيح العربية مش موثوق في ExcelJS)
    example.addRows([
        [
            'جوال',                     // المرحلة
            '1024',                     // رقم
            'أحمد محمد عبد الله',       // الاسم
            'هندسة',                    // الكلية
            'السنة الأولى',             // السنة الدراسية
            'القاهرة',                  // المنطقة
            new Date(2009, 2, 15),      // تاريخ الميلاد
            'أ/ محمود سيد',             // أب الاعتراف
            'فاطمة علي حسن',            // اسم الأم
            '01012345678',              // ت. الأب
            '01198765432',              // ت. الأم
            '15 شارع النصر، مدينة نصر', // العنوان
            '0225551234',               // الموبايل 1
            '01234567890',              // الموبايل 2
            '',                         // الموبايل 3
            'ahmed.example@gmail.com',  // البريد الإلكتروني
        ],
        [
            'جوالة',
            '1025',
            'مريم خالد إبراهيم',
            'طب',
            'السنة الثانية',
            'الجيزة',
            new Date(2010, 7, 22),
            'أ/ محمود سيد',
            'هدى سمير فؤاد',
            '01055512345',
            '01277788899',
            '8 شارع الجمهورية، الدقي',
            '0233334444',
            '01555566778',
            '',
            'mariam.example@gmail.com',
        ],
    ]);
    example.getColumn(7).numFmt = 'dd/mm/yyyy';

    // ===== التنزيل =====
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `قالب_استيراد_الأعضاء.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
};

export default function ImportMembers() {
    const { members, addMembers, createMemberAccounts } = useStore();
    const [preview, setPreview] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [accountSummary, setAccountSummary] = useState(null);
    const fileInputRef = useRef(null);

    // ✅ دالة تحويل Excel Serial Date إلى تاريخ حقيقي
    const excelDateToJSDate = (serial) => {
        if (!serial || typeof serial !== 'number') return '';
        const utcDays = Math.floor(serial - 25569);
        const utcValue = utcDays * 86400;
        const dateInfo = new Date(utcValue * 1000);
        const year = dateInfo.getFullYear();
        const month = String(dateInfo.getMonth() + 1).padStart(2, '0');
        const day = String(dateInfo.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // ✅ دالة تحويل أي صيغة تاريخ
    const parseDate = (value) => {
        if (!value) return '';

        // لو رقم (Excel serial date)
        if (typeof value === 'number') {
            return excelDateToJSDate(value);
        }

        // لو خلية تاريخ حقيقية في Excel — بتتحمل ككائن Date
        if (value instanceof Date && !isNaN(value)) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        const str = value.toString().trim();

        // لو بصيغة يوم/شهر/سنة
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                let day = parts[0].padStart(2, '0');
                let month = parts[1].padStart(2, '0');
                let year = parts[2];
                if (year.length === 2) year = '20' + year;
                return `${year}-${month}-${day}`;
            }
        }

        // لو بصيغة سنة-شهر-يوم
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
            const parts = str.split('-');
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }

        return '';
    };

    // ✅ دالة التحقق من رقم الموبايل (يبدأ بـ 010/011/012/015)
    const isValidMobile = (num) => {
        if (!num || num === '-' || num === '_' || num === '') return '';
        let cleaned = num.toString().trim();

        // إزالة أي مسافات أو شرطات
        cleaned = cleaned.replace(/[\s\-_]/g, '');

        // لو الرقم يبدأ بـ 1 وطوله 10، أضف "01" في البداية
        if (cleaned.startsWith('1') && cleaned.length === 10) {
            cleaned = '01' + cleaned;
        }
        // لو الرقم يبدأ بـ 1 وطوله 11، أضف "0" في البداية
        else if (cleaned.startsWith('1') && cleaned.length === 11) {
            cleaned = '0' + cleaned;
        }

        // التحقق من أن الرقم يبدأ بـ 010 أو 011 أو 012 أو 015
        if (cleaned.startsWith('010') || cleaned.startsWith('011') ||
            cleaned.startsWith('012') || cleaned.startsWith('015')) {
            return cleaned;
        }

        return '';
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setError('');
        setSuccess('');
        setLoading(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const buffer = evt.target.result;
                const ExcelJS = await loadExcel();
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const firstSheet = workbook.worksheets[0];
                const jsonData = [];
                firstSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                  if (rowNumber === 1) return; // skip header row
                  const obj = {};
                  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    const header = firstSheet.getRow(1).getCell(colNumber).value;
                    if (header) {
                      obj[header] = cell.value ?? '';
                    }
                  });
                  jsonData.push(obj);
                });

                const processed = [];
                let currentStage = '';

                for (let i = 0; i < jsonData.length; i++) {
                    const row = jsonData[i];

                    if (!row || Object.keys(row).length === 0) continue;

                    const rowValues = Object.values(row);
                    if (rowValues.every(cell => !cell || cell.toString().trim() === '')) continue;

                    const firstCol = rowValues[0]?.toString() || '';

                    // تحديد المرحلة
                    if (firstCol && (
                        firstCol.includes('رائد') ||
                        firstCol.includes('قائد') ||
                        firstCol.includes('قادة') ||
                        firstCol.includes('جوالة') ||
                        firstCol.includes('متقدم') ||
                        firstCol.includes('كشاف') ||
                        firstCol.includes('اشبال') ||
                        firstCol.includes('مرشدات') ||
                        firstCol.includes('رواد') ||
                        firstCol.includes('رائدات') ||
                        firstCol.includes('رائدات') ||
                        firstCol.includes('جوالات') ||
                        firstCol.includes('كشافات') ||
                        firstCol.includes('اشبال') ||
                        firstCol.includes('زهرات')
                    )) {
                        currentStage = firstCol.trim();
                    }

                    // تجاهل العناوين
                    if (firstCol && (
                        firstCol.includes('لجنة') ||
                        firstCol.includes('خارج الخدمة') ||
                        firstCol.includes('تأجيل') ||
                        firstCol.includes('المرحلة') ||
                        firstCol.includes('كود الاستمارة') ||
                        firstCol.includes('رقم')
                    )) continue;

                    // ✅ قراءة البيانات مع التعامل مع الأخطاء الإملائية
                    const name = row['الاسم']?.toString().trim() || '';
                    if (!name || name.length < 3) continue;

                    // تحديد المرحلة الكشفية — بالنسخة الصحيحة (مذكر/مؤنث):
                    // "جوالة" → جوالة، "مرشدات" → مرشدات، "زهرات" → زهرات... إلخ
                    const stageGender = stageGenderFromRaw(currentStage);
                    const scoutStage = stageGender
                      ? (stageGender.female
                          ? STAGES_FEMALE[stageGender.key]
                          : STAGES_MALE[stageGender.key])
                      : '';

                    // المرحلة الدراسية
                    const eduText = row['السنة الدراسية']?.toString() || row['السنة الدراسية القادمة']?.toString() || '';
                    let eduStage = '';
                    if (eduText.includes('خريج')) eduStage = 'متخرج';
                    else if (eduText.includes('جامعة')) eduStage = 'جامعة';
                    else if (eduText.includes('ثانوى') || eduText.includes('ثانوي')) eduStage = 'ثانوي';
                    else if (eduText.includes('اعدادى') || eduText.includes('إعدادي')) {
                        if (eduText.includes('3')) eduStage = '3 إعدادي';
                        else if (eduText.includes('2')) eduStage = '2 إعدادي';
                        else if (eduText.includes('1') || eduText.includes('اولى')) eduStage = '1 إعدادي';
                        else eduStage = 'إعدادي';
                    }
                    else if (eduText.includes('ابتدائى') || eduText.includes('ابتدائي')) {
                        const match = eduText.match(/(\d+)/);
                        if (match) eduStage = `${match[1]} ابتدائي`;
                        else eduStage = 'ابتدائي';
                    }

                    // ✅ تاريخ الميلاد (يتعامل مع Excel serial date)
                    const birthDateRaw = row['تاريخ الميلاد'];
                    const birthDate = parseDate(birthDateRaw);

                    // أب الاعتراف
                    const confessor = row['أب الاعتراف']?.toString().replace(/ا\/\s*/g, '').trim() ||
                        row['اب الاعتراف']?.toString().replace(/ا\/\s*/g, '').trim() || '';

                    // اسم الأم
                    const motherName = row['اسم الأم']?.toString().trim() ||
                        row['اسم الام / الزوجة']?.toString().trim() || '';

                    // ✅ الموبايلات (الموبايل 1 غالباً رقم المنزل، نتجاهله)
                    const mobile1 = row['الموبايل 1'];
                    const mobile2 = row['الموبايل 2'];
                    const mobile3 = row['الموبايل 3'];

                    // نستخدم الموبايل 2 و 3 فقط (الموبايل 1 غالباً رقم منزل)
                    const phone = isValidMobile(mobile2);
                    const mobile2Valid = isValidMobile(mobile3);

                    // أرقام الأب والأم
                    const fatherPhone = isValidMobile(row['ت. الأب'] || row['ت. الاب / الزوج']);
                    const motherPhone = isValidMobile(row['ت. الأم'] || row['ت. الام / الزوجة']);

                    // البحث عن الإيميل
                    let email = '';
                    for (let key in row) {
                        const cell = row[key]?.toString().trim() || '';
                        if (cell.includes('@') && cell.includes('.')) {
                            email = cell;
                            break;
                        }
                    }

                    processed.push({
                        name: name,
                        fatherName: confessor,
                        motherName: motherName,
                        college: row['الكلية']?.toString().trim() || row['الكلبة']?.toString().trim() || '',
                        birthDate: birthDate,
                        scoutStage: scoutStage,
                        educationStage: eduStage,
                        email: email,
                        phone: phone, // الموبايل 2
                        fatherPhone: fatherPhone,
                        motherPhone: motherPhone,
                        mobile2: mobile2Valid, // الموبايل 3
                        address: row['العنوان']?.toString().trim() || '',
                        governorate: row['المنطقة']?.toString().trim() || '',
                        confessor: confessor,
                        scoutNumber: row['رقم']?.toString().trim() || '',
                        siblingsCount: 0,
                    });
                }

                // حساب عدد الإخوة
                const withSiblingsCount = processed.map((member) => {
                    const siblings = processed.filter(
                        (m) =>
                            m.fatherName &&
                            m.motherName &&
                            m.fatherName === member.fatherName &&
                            m.motherName === member.motherName
                    );
                    return {
                        ...member,
                        siblingsCount: siblings.length > 1 ? siblings.length - 1 : 0,
                    };
                });

                if (withSiblingsCount.length === 0) {
                    setError('لم يتم العثور على بيانات صالحة في الملف');
                    setLoading(false);
                    return;
                }

                setPreview(withSiblingsCount);
                setLoading(false);
            } catch (err) {
                console.error('Error:', err);
                setError('خطأ في قراءة الملف: ' + err.message);
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImport = async () => {
        if (preview.length === 0) return;
        setLoading(true);
        setError('');
        setSuccess('');
        setAccountSummary(null);
        try {
            const created = await addMembers(preview);
            setSuccess(`✅ تم استيراد ${created.length} عضو بنجاح!`);
            setPreview([]);
            if (fileInputRef.current) fileInputRef.current.value = '';

            // ✅ إنشاء حسابات الدخول تلقائياً بعد الاستيراد (كود الكشاف = كلمة المرور)
            if (created.length > 0) {
                const noEmail = created.filter(m => !(m.email || '').trim());
                const withAccount = created.filter(
                    m => (m.email || '').trim() && (m.scoutCode || '').trim()
                );
                if (withAccount.length > 0) {
                    try {
                        // ✅ الباسورد المثبت لكل مرحلة — العضو يدخل بيها أول مرة
                        // ويعيّن باسورده الخاص (مش باسورد عشوائي لكل عضو)
                        const generatedByEmail = {};
                        const accountsToCreate = withAccount.map(m => {
                            const pwd = stagePasswordFor(m.scoutStage) || generateTempPassword();
                            generatedByEmail[m.email.trim()] = pwd;
                            return {
                                member_id: m.id,
                                email: m.email,
                                password: pwd,
                                full_name: m.name,
                            };
                        });
                        const summary = await createMemberAccounts(accountsToCreate);
                        setAccountSummary({
                            ...summary,
                            noEmailCount: noEmail.length,
                            generatedPasswords: generatedByEmail,
                            // بيانات الحساب هتتبعت على الإيميلات تلقائياً —
                            // الحالة بتتحدث في الملخص بعد الإرسال
                            emailResults: { loading: true },
                        });
                        // الإرسال الفعلي — الأدمن بس، والنتيجة بتتحدث في نفس الملخص
                        const emailResults = await sendCredentialsEmail(
                            accountsToCreate.map((a) => ({
                                email: a.email,
                                password: a.password,
                                name: a.full_name,
                            }))
                        );
                        setAccountSummary((prev) =>
                            prev ? { ...prev, emailResults } : prev
                        );
                    } catch (accErr) {
                        setAccountSummary({
                            error: accErr?.message || String(accErr),
                            noEmailCount: noEmail.length,
                        });
                    }
                } else {
                    setAccountSummary({ created: 0, linked: 0, failed: [], noEmailCount: noEmail.length });
                }
            }
        } catch (err) {
            setError('فشل الاستيراد: ' + (err?.message || err));
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setPreview([]);
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h2 className="text-2xl font-bold text-maroon-800">📂 استيراد أعضاء من ملف Excel</h2>
                {/* ✅ زر تنزيل القالب الجاهز — نفس الأعمدة اللي المحرك بيقراها */}
                <button
                    type="button"
                    onClick={downloadImportTemplate}
                    className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-800 active:scale-[0.99]"
                    title="تنزيل ملف Excel جاهز للملء بنفس تنسيق الاستيراد"
                >
                    ⬇️ تنزيل قالب الاستيراد (Excel)
                </button>
            </div>

            <div className="bg-earth-50 border border-earth-200 rounded-lg p-4 mb-6">
                <h3 className="font-bold text-earth-900 mb-2">📋 تنسيق الملف المطلوب:</h3>
                <p className="text-sm text-earth-700 mb-3">الأسهل: نزّل القالب الجاهز من الزر اللي فوق واملأه على طول — الأعمدة متظبطة والمرحلة بقائمة منسدلة. الأعمدة:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                    {TEMPLATE_COLUMNS.map((c) => (
                        <span key={c.header} className="bg-maroon-100 text-maroon-800 px-2 py-1 rounded font-mono">
                            {c.header}
                        </span>
                    ))}
                </div>
                <p className="text-xs text-earth-600 bg-yellow-50 p-2 rounded">
                    💡 <strong>ملاحظة:</strong> الموبايل 1 غالباً رقم منزل وسيتم تجاهله. عدد الإخوات يُحسب تلقائياً.
                </p>
            </div>

            <div className="border-2 border-dashed border-earth-300 rounded-lg p-8 text-center bg-white mb-6">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="excel-upload"
                />
                <label
                    htmlFor="excel-upload"
                    className="cursor-pointer inline-flex items-center gap-2 bg-maroon-700 text-white px-6 py-3 rounded-lg hover:bg-maroon-800 transition font-bold"
                >
                    📤 {loading ? 'جاري المعالجة...' : 'اختر ملف Excel للرفع'}
                </label>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    {success}
                </div>
            )}

            {accountSummary && <MemberAccountsSummary summary={accountSummary} />}

            {preview.length > 0 && (
                <div className="bg-white border border-earth-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-earth-200 bg-earth-50">
                        <h3 className="font-bold text-earth-900">👀 معاينة البيانات ({preview.length} عضو)</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm border border-earth-300 rounded-lg hover:bg-earth-50 text-earth-700"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleImport}
                                className="px-4 py-2 text-sm bg-maroon-700 text-white rounded-lg hover:bg-maroon-800 font-bold"
                            >
                                ✅ تأكيد الاستيراد
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-sm">
                            <thead className="bg-earth-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-right border-b">#</th>
                                    <th className="px-3 py-2 text-right border-b">الاسم</th>
                                    <th className="px-3 py-2 text-right border-b">أب الاعتراف</th>
                                    <th className="px-3 py-2 text-right border-b">اسم الأم</th>
                                    <th className="px-3 py-2 text-right border-b">الكلية</th>
                                    <th className="px-3 py-2 text-right border-b">المرحلة</th>
                                    <th className="px-3 py-2 text-right border-b">الميلاد</th>
                                    <th className="px-3 py-2 text-right border-b">عدد الإخوة</th>
                                    <th className="px-3 py-2 text-right border-b">الموبايل</th>
                                    <th className="px-3 py-2 text-right border-b">الإيميل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((member, idx) => (
                                    <tr key={idx} className="border-b border-earth-100 hover:bg-earth-50">
                                        <td className="px-3 py-2">{idx + 1}</td>
                                        <td className="px-3 py-2 font-medium">{member.name}</td>
                                        <td className="px-3 py-2">{member.fatherName || '-'}</td>
                                        <td className="px-3 py-2">{member.motherName || '-'}</td>
                                        <td className="px-3 py-2 text-xs">{member.college || '-'}</td>
                                        <td className="px-3 py-2">
                                            <span className="bg-maroon-100 text-maroon-800 px-2 py-1 rounded text-xs font-bold">
                                                {member.scoutStage}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs">{member.birthDate || '-'}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${member.siblingsCount > 0
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {member.siblingsCount}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs dir-ltr text-right">{member.phone || '-'}</td>
                                        <td className="px-3 py-2 text-xs text-earth-600">{member.email || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}