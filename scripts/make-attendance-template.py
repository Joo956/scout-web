# -*- coding: utf-8 -*-
"""
قالب إكسل: توزيع الأعضاء على الفصول + تعيين المسئولين
(نموذج مقترح للمراجعة والتوحيد — بدون أي بيانات حقيقية)
"""
import sys, os

XLSX_SKILL_DIR = r"C:\Users\Pavly Labib\.zcode\cli\plugins\cache\zcode-plugins-official\document-skills\0.1.4\skills\xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)

import base
# خط عربي مناسب على ويندوز (Calibri يدعم العربي ودي فونت إكسل الافتراضية)
base.FONT_NAME = "Calibri"
base.HEADER_BOLD = True
from base import (
    PRIMARY, SECONDARY, NEUTRAL_900, NEUTRAL_600, NEUTRAL_200, NEUTRAL_100, NEUTRAL_0,
    setup_sheet, style_header_row, style_data_row,
    auto_fit_columns, auto_fit_row_heights,
)
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

STAGES = ["أشبال / زهرات", "كشاف / مرشدات", "متقدم / رائدات", "جوال / جوالة", "قائد / قائدة", "رائد / رائدة"]
ROLES = ["مسئول مرحلة", "مسئول فصل", "قائد فصل (مدرس)"]
CLASSES = ["فصل 1", "فصل 2"]

wb = Workbook()

# ============================================================
# 1) شيت التعليمات
# ============================================================
ws = wb.active
ws.title = "تعليمات"
ws.sheet_view.rightToLeft = True
setup_sheet(ws, title="قالب توزيع الأعضاء على الفصول وتعيين المسئولين", last_col=3)

rows = [
    ("1", "املأ شيت «الأعضاء»: كل صف = عضو واحد. العمود الإجباري الوحيد هو «كود كشافي» — ده المفتاح اللي بيتطابق عليه النظام."),
    ("2", "اكتب اسم العضو زي ما هو بالنظام عشان يتأكد من المطابقة وقت الرفع (اسم مطابق للكود = أمان أكتر)."),
    ("3", "اختار «الفصل» من القائمة المنسدلة. لو سيبته فاضي = العضو هيتسحب من فصله الحالي (هيبقى بدون فصل)."),
    ("4", "لو كتبت اسم فصل جديد مش موجود في القائمة، النظام هيطلب من الأدمن موافقته على إنشاء الفصل الجديد أثناء الرفع."),
    ("5", "املأ شيت «المسئولين»: كل صف = تعيين واحد. اختار الدور من القائمة، وحدد المرحلة دايماً."),
    ("6", "«مسئول مرحلة» = بيشوف كل فصول مرحلته. «مسئول فصل» و«قائد فصل (مدرس)» = لازم تحدد الفصل وبيشوفوا فصله فقط."),
    ("7", "كل شخص لازم يكون له إيميل واحد مسجل في بياناته — أي مسئول من غير إيميل هيرفضه النظام مع ذكر اسمه."),
    ("8", "مفيش أي حاجة بتتحذف بالرفع: الأعضاء اللي مش مذكورين في الشيت فصولهم بتفضل زي ما هي."),
    ("9", "قبل الرفع الفعلي النظام بيعرض لك ملخص (كام عضو هيتوزع، كام مسئول هيتعين، الأخطاء لو فيه) وتأكد بنفسك."),
]
r = 4
ws.cell(row=4, column=2, value="#")
ws.cell(row=4, column=3, value="الخطوة")
style_header_row(ws, row_num=4, col_start=2, col_end=3)
for i, (n, t) in enumerate(rows):
    rn = 5 + i
    ws.cell(row=rn, column=2, value=n)
    ws.cell(row=rn, column=3, value=t)
    style_data_row(ws, row_num=rn, col_start=2, col_end=3, row_index=i)
ws.column_dimensions["B"].width = 5
ws.column_dimensions["C"].width = 95
auto_fit_row_heights(ws, header_row=4, data_start_row=5)

# ============================================================
# 2) شيت الأعضاء (التوزيع على الفصول)
# ============================================================
ws2 = wb.create_sheet("الأعضاء")
ws2.sheet_view.rightToLeft = True
headers2 = ["كود كشافي *", "اسم العضو", "المرحلة", "الفصل *"]
setup_sheet(ws2, title="توزيع الأعضاء على الفصول — صف لكل عضو", last_col=len(headers2) + 1)
for c, h in enumerate(headers2, 2):
    ws2.cell(row=4, column=c, value=h)
style_header_row(ws2, row_num=4, col_start=2, col_end=len(headers2) + 1)

example_members = [
    ["#AE-0000-0000-مثال1", "اسم العضو الأول (مثال — امسحه)", "كشاف", "فصل 1"],
    ["#AE-0000-0000-مثال2", "اسم العضو التاني (مثال — امسحه)", "زهرات", "فصل 2"],
    ["#AE-0000-0000-مثال3", "اسم العضو التالت (مثال — امسحه)", "مرشدات", "فصل 1"],
]
for i, row in enumerate(example_members):
    rn = 5 + i
    for c, v in enumerate(row, 2):
        ws2.cell(row=rn, column=c, value=v)
    style_data_row(ws2, row_num=rn, col_start=2, col_end=len(headers2) + 1, row_index=i)

# قوائم منسدلة: الفصل (فصل 1/فصل 2 + مساحة لأسماء جديدة — تحذير بس بدون منع)
dv_class = DataValidation(
    type="list", formula1='"فصل 1,فصل 2"', allow_blank=True,
    showErrorMessage=False, showDropDown=False,
)
dv_class.error = "الفصل مش من القائمة — هيتطلب موافقة الأدمن على إنشائه"
dv_class.errorTitle = "فصل جديد"
ws2.add_data_validation(dv_class)
dv_class.add("E5:E500")

# المرحلة — عمود تحقق فقط (من غير منع)
dv_stage2 = DataValidation(type="list", formula1='"' + ",".join(STAGES) + '"', allow_blank=True, showErrorMessage=False)
ws2.add_data_validation(dv_stage2)
dv_stage2.add("D5:D500")

note = ws2.cell(row=9, column=2, value="* إجباري — الكود لازم يطابق كود عضو موجود بالنظام بالظبط. صفوف الأمثلة امسحها قبل الرفع.")
note.font = Font(name=base.FONT_NAME, size=9, color=NEUTRAL_600)
auto_fit_columns(ws2, min_width=10, max_width=34, header_row=4, data_start_row=5)
auto_fit_row_heights(ws2, header_row=4, data_start_row=5)
ws2.freeze_panes = "C5"

# ============================================================
# 3) شيت المسئولين (التعيينات)
# ============================================================
ws3 = wb.create_sheet("المسئولين")
ws3.sheet_view.rightToLeft = True
headers3 = ["كود كشافي للمسئول *", "اسم المسئول", "الدور *", "المرحلة *", "الفصل", "إيميل المسئول (للتحقق)"]
setup_sheet(ws3, title="تعيين المسئولين — صف لكل تعيين", last_col=len(headers3) + 1)
for c, h in enumerate(headers3, 2):
    ws3.cell(row=4, column=c, value=h)
style_header_row(ws3, row_num=4, col_start=2, col_end=len(headers3) + 1)

example_staff = [
    ["#AE-0000-0000-مثال4", "اسم مسئول المرحلة (مثال — امسحه)", "مسئول مرحلة", "كشاف / مرشدات", "", "example4@mail.com"],
    ["#AE-0000-0000-مثال5", "اسم مسئول الفصل (مثال — امسحه)", "مسئول فصل", "كشاف / مرشدات", "فصل 1", "example5@mail.com"],
    ["#AE-0000-0000-مثال6", "اسم قائد الفصل (مثال — امسحه)", "قائد فصل (مدرس)", "كشاف / مرشدات", "فصل 1", "example6@mail.com"],
]
for i, row in enumerate(example_staff):
    rn = 5 + i
    for c, v in enumerate(row, 2):
        ws3.cell(row=rn, column=c, value=v)
    style_data_row(ws3, row_num=rn, col_start=2, col_end=len(headers3) + 1, row_index=i)

dv_role = DataValidation(type="list", formula1='"' + ",".join(ROLES) + '"', allow_blank=False, showErrorMessage=True)
dv_role.error = "اختار الدور من القائمة"
ws3.add_data_validation(dv_role)
dv_role.add("D5:D500")

dv_stage3 = DataValidation(type="list", formula1='"' + ",".join(STAGES) + '"', allow_blank=False, showErrorMessage=True)
dv_stage3.error = "اختار المرحلة من القائمة"
ws3.add_data_validation(dv_stage3)
dv_stage3.add("E5:E500")

dv_class3 = DataValidation(type="list", formula1='"فصل 1,فصل 2"', allow_blank=True, showErrorMessage=False)
ws3.add_data_validation(dv_class3)
dv_class3.add("F5:F500")

note3 = ws3.cell(row=9, column=2, value="الفصل مطلوب لـ«مسئول فصل» و«قائد فصل (مدرس)» فقط — مسئول المرحلة من غير فصل. الإيميل للتحقق بس ومش بيتغير من الشيت.")
note3.font = Font(name=base.FONT_NAME, size=9, color=NEUTRAL_600)
auto_fit_columns(ws3, min_width=10, max_width=34, header_row=4, data_start_row=5)
auto_fit_row_heights(ws3, header_row=4, data_start_row=5)
ws3.freeze_panes = "C5"

# ============================================================
# 4) شيت القوائم (مخفي — مصدر القوائم المنسدلة)
# ============================================================
ws4 = wb.create_sheet("القوائم")
ws4.sheet_view.rightToLeft = True
for i, s in enumerate(STAGES, 1):
    ws4.cell(row=i, column=1, value=s)
for i, c in enumerate(CLASSES, 1):
    ws4.cell(row=i, column=2, value=c)
for i, r_ in enumerate(ROLES, 1):
    ws4.cell(row=i, column=3, value=r_)
ws4.sheet_state = "hidden"

wb.properties.creator = "Z.ai"
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "قالب-توزيع-الحضور.xlsx")
wb.save(out)
print("saved:", out)
