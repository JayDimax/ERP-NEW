
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Student, StudentDocument, Batch, Qualification, isProvisionalStudent } from '../types';
import ModalPortal from '../components/ModalPortal';
import TesdaLearnerFormEntry from '../components/TesdaLearnerFormEntry';
import {
  REQUIRED_STUDENT_DOCUMENTS,
  getComplianceDocuments,
  getStudentProfilePhoto,
  normalizeStudentDocuments,
} from '../services/StudentDocumentService';
import {
  Search, Plus, Filter, User, Calendar, Mail, Phone, FileText,
  Upload, CheckCircle, Clock, Trash2, X, Camera, RefreshCw,
  UserCircle, UploadCloud, ShieldCheck, AlertCircle, FileSpreadsheet,
  CheckCircle2, AlertTriangle, ArrowRight, MapPin, Fingerprint,
  GraduationCap, Globe, Building2, Baby, Eye, ShieldAlert,
  ThumbsUp, ThumbsDown, Check, BookOpen, Briefcase, Heart,
  Printer, MoreVertical, ExternalLink, Shield, Download,
  CheckSquare, ChevronLeft, ChevronRight, Layers, Award,
  ChevronsLeft, ChevronsRight, Users
} from 'lucide-react';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter } from '../services/IDataService';
import {
  createLearnerCsvTemplate,
  LEARNER_CSV_HEADERS,
  LearnerCsvError,
  readLearnerCsv,
} from '../services/LearnerCsvService';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface PsgcArea {
  psgc_code: string;
  area_name: string;
  reg: number;
  prv: number;
  mun: number;
  bgy: number;
}

interface StudentsViewProps {
  orgId: string;
  students: Student[];
  batches?: Batch[];
  qualifications?: Qualification[];
  brandColor: string;
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBatchAddStudents: (students: Student[]) => Promise<void>;
  canCreateStudent?: boolean;
  canEditStudent?: boolean;
}

const MANDATORY_DOCS = REQUIRED_STUDENT_DOCUMENTS;

const PAGE_SIZE = 7;
const STUDENT_COLUMNS = 'id,org_id,uli,last_name,first_name,middle_name,extension,sex,date_of_birth,email,contact_number,street,barangay,city,province,guardian,location_id,sponsor_id,documents,created_at,updated_at,profile_photo,mailing_region,tesda_employment_status,tesda_employment_type,tesda_learner_classifications,tesda_other_classification,tesda_disability_types,tesda_disability_causes,tesda_course_qualification,tesda_scholarship_package,tesda_privacy_consent';
const PSGC_BASE_URL = 'https://classification.psa.gov.ph/psgc';
const PSGC_VERSION = 'Q2_2024';
const PSGC_TOKEN = import.meta.env.VITE_PSA_PSGC_TOKEN || '';

function withAlpha(hex: string, alpha: number): string {
  if (!hex) return '';
  const normalized = hex.replace('#', '');
  if (!/^[\da-fA-F]{6}$/.test(normalized)) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeStudentRecord(student: Student): Student {
  return {
    ...student,
    documents: normalizeStudentDocuments(student.documents),
  };
}

function escapePrintHtml(value?: string | number | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDateParts(dateValue?: string) {
  if (!dateValue) return { month: '', day: '', year: '', age: '' };
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return { month: '', day: '', year: '', age: '' };

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDelta = now.getMonth() - date.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) age -= 1;

  return {
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0'),
    year: String(date.getFullYear()),
    age: String(Math.max(0, age)),
  };
}

function buildLearnerProfilePrintHtml(student: Student, courseName: string): string {
  const fullName = [student.firstName, student.middleName, student.lastName, student.extension].filter(Boolean).join(' ');
  const dob = getDateParts(student.dateOfBirth);
  const photo = getStudentProfilePhoto(student);
  const selectedClassifications = student.tesdaLearnerClassifications?.length ? student.tesdaLearnerClassifications : ['Student'];
  const selectedDisabilities = student.tesdaDisabilityTypes || [];
  const selectedDisabilityCauses = student.tesdaDisabilityCauses || [];
  const selectedCourse = student.tesdaCourseQualification || courseName || '';

  const civilStatuses = ['Single', 'Married', 'Separated', 'Widowed', 'Common Law/Live-in'];
  const employmentStatuses = ['Wage-Employed', 'Underemployed', 'Self-Employed', 'Unemployed'];
  const employmentTypes = ['None', 'Casual', 'Probationary', 'Contractual', 'Regular', 'Job Order', 'Permanent', 'Temporary'];
  const educationOptions = [
    'No Grade Completed', 'Elementary Undergraduate', 'Elementary Graduate', 'High School Undergraduate', 'High School Graduate',
    'Junior High (K-12)', 'Senior High (K-12)', 'Post-Secondary Non-Tertiary/Technical Vocational Course Undergraduate',
    'Post-Secondary Non-Tertiary/Technical Vocational Course Graduate', 'College Undergraduate', 'College Graduate', 'Masteral', 'Doctorate'
  ];
  const classifications = [
    '4Ps Beneficiary', 'Agrarian Reform Beneficiary', 'Balik Probinsya', 'Displaced Workers', 'Drug Dependents Surrenderees/Surrenderers',
    'Family Members of AFP and PNP Killed-in-Action', 'Family Members of AFP and PNP Wounded-in-Action', 'Farmers and Fishermen',
    'Indigenous People & Cultural Communities', 'Industry Workers', 'Inmates and Detainees', 'MILF Beneficiary', 'Out-of-School-Youth',
    'Overseas Filipino Workers (OFW) Dependent', 'RCEF-RESP', 'Rebel Returnees/Decommissioned Combatants',
    'Returning/Repatriated Overseas Filipino Workers (OFW)', 'Student', 'TESDA Alumni', 'TVET Trainers', 'Uniformed Personnel',
    'Victim of Natural Disasters and Calamities', 'Wounded-in-Action AFP & PNP Personnel', 'Others'
  ];
  const disabilities = [
    'Mental/Intellectual', 'Visual Disability', 'Orthopedic (Musculoskeletal) Disability', 'Hearing Disability', 'Speech Impairment',
    'Multiple Disabilities, specify', 'Psychosocial Disability', 'Disability Due to Chronic Illness', 'Learning Disability'
  ];
  const disabilityCauses = ['Congenital/Inborn', 'Illness', 'Injury'];

  const field = (value?: string | number | null) => `<div class="field">${escapePrintHtml(value)}</div>`;
  const labeled = (label: string, value?: string | number | null) => `<div class="cell labeled">${field(value)}<div class="sub">${escapePrintHtml(label)}</div></div>`;
  const box = (label: string, checked: boolean) => `<div class="box"><span class="sq">${checked ? 'X' : ''}</span><span>${escapePrintHtml(label)}</span></div>`;
  const list = (items: string[], selected: string | string[] | undefined) => items.map(item => box(item, Array.isArray(selected) ? selected.includes(item) : selected === item)).join('');

  return `<!doctype html>
<html>
<head>
  <title>Learners Profile Form - ${escapePrintHtml(fullName)}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; }
    .sheet { width: 210mm; min-height: 297mm; padding: 7mm; page-break-after: always; background: #fff; }
    .sheet:last-child { page-break-after: auto; }
    .grid { display: grid; }
    .border { border: 1px solid #222; }
    .cell { border: 1px solid #222; min-height: 10mm; }
    .section { border: 1px solid #222; background: #eee; padding: 1.5mm 2mm; font-size: 13px; font-weight: 900; line-height: 1; }
    .field { min-height: 8mm; padding: 1.5mm 2mm; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .sub { border-top: 1px solid #222; padding: .7mm 1mm; text-align: center; font-size: 9px; font-weight: 800; line-height: 1; }
    .label { padding: 2mm; font-size: 10px; font-weight: 800; line-height: 1.15; }
    .title { border-left: 1px solid #222; border-right: 1px solid #222; border-bottom: 1px solid #222; text-align: center; font-size: 28px; font-weight: 900; letter-spacing: .08em; padding: 1mm 0; }
    .profile-title { display: flex; align-items: center; justify-content: center; min-height: 32mm; font-family: 'Arial Black', Arial, Helvetica, sans-serif; font-size: 19px; font-weight: 900; letter-spacing: .24em; }
    .logo { width: 15mm; height: 15mm; object-fit: contain; }
    .photo { width: 35mm; height: 45mm; border: 2px solid #222; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 11px; font-weight: 700; overflow: hidden; }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .box { min-height: 5mm; display: flex; align-items: flex-start; gap: 1.5mm; font-size: 10px; font-weight: 700; line-height: 1.12; }
    .sq { width: 3.2mm; height: 3.2mm; border: 1px solid #333; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; font-size: 8px; font-weight: 900; line-height: 1; margin-top: .2mm; }
    .muted { font-size: 10px; font-weight: 700; font-style: italic; }
    .sig-line { border-bottom: 1px solid #222; height: 12mm; }
    .sig-label { text-align: center; font-size: 10px; font-weight: 900; }
    @media screen { body { background: #e5e7eb; padding: 16px; } .sheet { margin: 0 auto 16px; box-shadow: 0 8px 30px rgba(0,0,0,.18); } }
  </style>
</head>
<body>
  <section class="sheet">
    <div class="grid border" style="grid-template-columns: 32mm 1fr 24mm;">
      <div class="cell" style="border:0;border-right:1px solid #222;display:flex;align-items:center;justify-content:center;"><img class="logo" src="/print-templates/tesda-logo.svg" /></div>
      <div style="text-align:center;padding:2mm 0;"><div style="font-size:16px;font-weight:900;">Technical Education and Skills Development Authority</div><div style="font-size:13px;font-weight:700;">Pangasiwaan sa Edukasyong Teknikal at Pagpapaunlad ng Kasanayan</div></div>
      <div class="cell" style="border:0;border-left:1px solid #222;display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;font-weight:900;font-style:italic;">MIS 03-01<br/>(ver. 2021)</div>
    </div>
    <div class="title">Registration Form</div>
    <div class="grid" style="grid-template-columns: 1fr 42mm;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;">
      <div class="profile-title">LEARNERS PROFILE FORM</div>
      <div style="padding:3mm;display:flex;justify-content:center;">${photo ? `<div class="photo"><img src="${escapePrintHtml(photo)}" /></div>` : '<div class="photo">I.D. Picture</div>'}</div>
    </div>

    <div class="section">1. T2MIS Auto Generated</div>
    <div class="grid" style="grid-template-columns: 38mm 1fr 30mm 45mm;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;">
      <div class="label">1.1.<br/>Unique Learner<br/>Identifier (ULI) Number:</div>${field(student.uli)}<div class="label">1.2. Entry Date:</div><div class="field" style="text-align:center;">mm/dd/yy</div>
    </div>

    <div class="section">2. Learner/Manpower Profile</div>
    <div class="grid" style="grid-template-columns: 32mm 1fr 1fr 38mm;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;">
      <div class="cell label">2.1. &nbsp; Name:</div>${labeled('Last Name, Extension Name (Jr., Sr.)', [student.lastName, student.extension].filter(Boolean).join(', '))}${labeled('First', student.firstName)}${labeled('Middle', student.middleName)}
      <div class="cell label" style="grid-row:span 3;text-align:center;">2.2<br/>Complete<br/>Permanent<br/>Mailing<br/>Address:</div>${labeled('Number, Street', student.street)}${labeled('Barangay', student.barangay)}${labeled('District', student.district)}
      ${labeled('City/Municipality', student.city)}${labeled('Province', student.province)}${labeled('Region', student.mailingRegion)}
      ${labeled('Email Address/Facebook Account', student.email)}${labeled('Contact No:', student.contactNumber)}${labeled('Nationality', student.nationality)}
    </div>

    <div class="section">3. Personal Information</div>
    <div class="grid" style="grid-template-columns: 42mm 58mm 1fr;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;">
      <div class="cell label"><b>3.1. Sex</b><div style="margin-top:8mm;">${box('Male', String(student.sex).toLowerCase() === 'male')}${box('Female', String(student.sex).toLowerCase() === 'female')}</div></div>
      <div class="cell label"><b>3.2. Civil Status</b><div style="margin-top:5mm;">${list(civilStatuses, student.civilStatus)}</div></div>
      <div class="cell label"><b>3.3 Employment (before the training)</b><div class="grid" style="grid-template-columns: 38mm 1fr;gap:5mm;margin-top:3mm;"><div><b>Employment Status</b>${list(employmentStatuses, student.tesdaEmploymentStatus)}</div><div><b>Employment Type</b><br/><span class="muted">(if Wage-employed or Underemployed)</span><div class="grid" style="grid-template-columns:1fr 1fr;gap:0 4mm;">${list(employmentTypes, student.tesdaEmploymentType)}</div></div></div></div>
    </div>
    <div class="grid" style="grid-template-columns: 32mm 1fr 1fr 1fr 38mm;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;"><div class="label">3.4 Birthdate</div>${labeled('Month of Birth', dob.month)}${labeled('Day of Birth', dob.day)}${labeled('Year of Birth', dob.year)}${labeled('Age', dob.age)}</div>
    <div class="grid" style="grid-template-columns: 32mm 1fr 1fr 38mm;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;"><div class="label">3.5 Birthplace</div>${labeled('City/Municipality', student.birthCity)}${labeled('Province', student.birthProvince)}${labeled('Region', student.birthRegion)}</div>
    <div style="border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;padding:1.5mm;"><div class="label" style="padding:0;">3.6 Educational Attainment Before the Training (Trainee)</div><div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:1mm 5mm;margin-top:2mm;">${list(educationOptions, student.educationalAttainment)}</div></div>
    <div class="grid" style="grid-template-columns: 42mm 1fr 1.4fr;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;"><div class="label">3.7 Parent/Guardian</div>${labeled('Name', student.guardian)}${labeled('Complete Permanent Mailing Address', '')}</div>
  </section>

  <section class="sheet">
    <div class="section">4. Learner/Trainee/Student (Clients) Classification:</div>
    <div class="grid" style="grid-template-columns:1fr 1fr 1fr;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;">${classifications.map((item) => `<div class="cell label">${box(item, selectedClassifications.includes(item))}${item === 'Others' ? `<div class="field">${escapePrintHtml(student.tesdaOtherClassification)}</div>` : ''}</div>`).join('')}</div>
    <div class="section">5. Type of Disability (for Persons with Disability Only): <span class="muted">To be filled up by the TESDA personnel</span></div>
    <div class="grid" style="grid-template-columns:1fr 1fr 1fr;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;">${disabilities.map(item => `<div class="cell label">${box(item, selectedDisabilities.includes(item))}</div>`).join('')}</div>
    <div class="section">6. Causes of Disability (for Persons with Disability Only): <span class="muted">To be filled up by the TESDA personnel</span></div>
    <div class="grid" style="grid-template-columns:1fr 1fr 1fr;border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;">${disabilityCauses.map(item => `<div class="cell label">${box(item, selectedDisabilityCauses.includes(item))}</div>`).join('')}</div>
    <div class="section">7. Name of Course/Qualification</div><div class="field border" style="border-top:0;min-height:12mm;">${escapePrintHtml(selectedCourse)}</div>
    <div class="section">8. If Scholar, What Type of Scholarship Package (TWSP, PESFA, STEP, others)?</div><div class="field border" style="border-top:0;min-height:12mm;">${escapePrintHtml(student.tesdaScholarshipPackage)}</div>
    <div class="section">9. Privacy Consent and Disclaimer</div><div class="label" style="border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;font-style:italic;">I hereby attest that I have read and understood the Privacy Notice of TESDA through its website (https://www.tesda.gov.ph) and thereby giving my consent in the processing of my personal information indicated in this Learners Profile. The processing includes scholarships, employment, survey, and all other related TESDA programs that may be beneficial to my qualifications.<div style="display:flex;justify-content:center;gap:25mm;margin-top:4mm;font-style:normal;">${box('Agree', student.tesdaPrivacyConsent === 'Agree')}${box('Disagree', student.tesdaPrivacyConsent === 'Disagree')}</div></div>
    <div class="section">10. Applicant's Signature</div><div style="border-left:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;padding:8mm;"><div style="text-align:center;font-size:11px;font-weight:700;font-style:italic;margin-bottom:12mm;">This is to certify that the information stated above is true and correct.</div><div class="grid" style="grid-template-columns:1fr 50mm 38mm;gap:8mm;"><div><div class="sig-line"></div><div class="sig-label">APPLICANT'S SIGNATURE OVER PRINTED NAME</div><div style="height:18mm;"></div><div style="font-size:11px;font-weight:700;">Noted by:</div><div class="sig-line"></div><div class="sig-label">REGISTRAR/SCHOOL ADMINISTRATOR<br/>(Signature Over Printed Name)</div></div><div><div class="sig-line"></div><div class="sig-label">DATE ACCOMPLISHED</div><div style="height:28mm;"></div><div class="sig-line"></div><div class="sig-label">DATE RECEIVED</div></div><div><div class="photo" style="width:35mm;height:35mm;">1x1 picture taken<br/>within the last 6<br/>months</div><div style="height:6mm;"></div><div class="photo" style="width:35mm;height:28mm;"></div><div class="sig-label">Right Thumbmark</div></div></div></div>
  </section>
  <script>Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; }))).then(() => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;
}
const StudentsView: React.FC<StudentsViewProps> = ({ orgId, students, batches = [], qualifications = [], brandColor, onAddStudent, onUpdateStudent, onDeleteStudent, onBatchAddStudents, canCreateStudent = true, canEditStudent = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [complianceFilter, setComplianceFilter] = useState<'ALL' | 'COMPLIANT' | 'PENDING' | 'REJECTED' | 'PROVISIONAL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'all' | 'batch'>('all');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showTesdaForm, setShowTesdaForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const provisionalStudentsCount = useMemo(() => {
    return students.filter(isProvisionalStudent).length;
  }, [students]);
  const [importPreview, setImportPreview] = useState<Student[]>([]);
  const [importErrors, setImportErrors] = useState<LearnerCsvError[]>([]);
  const [importTotalRows, setImportTotalRows] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const importInvalidRows = useMemo(() => {
    if (importErrors.some(error => error.row === 1)) return importTotalRows;
    return new Set(importErrors.map(error => error.row).filter(row => row > 1)).size;
  }, [importErrors, importTotalRows]);
  const [showCamera, setShowCamera] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [showEditCamera, setShowEditCamera] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [psgcRegions, setPsgcRegions] = useState<PsgcArea[]>([]);
  const [psgcProvinces, setPsgcProvinces] = useState<PsgcArea[]>([]);
  const [psgcCities, setPsgcCities] = useState<PsgcArea[]>([]);
  const [psgcBarangays, setPsgcBarangays] = useState<PsgcArea[]>([]);
  const [psgcLoading, setPsgcLoading] = useState(false);
  const [psgcError, setPsgcError] = useState<string | null>(null);
  const [selectedPsgcRegion, setSelectedPsgcRegion] = useState('');
  const [selectedPsgcProvince, setSelectedPsgcProvince] = useState('');
  const [selectedPsgcCity, setSelectedPsgcCity] = useState('');
  const [serverStudents, setServerStudents] = useState<Student[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadError, setPageLoadError] = useState('');

  const [auditStudent, setAuditStudent] = useState<Student | null>(null);

  const [mandatoryDocStatuses, setMandatoryDocStatuses] = useState<Record<string, 'PENDING' | 'UPLOADED' | 'VERIFIED'>>({
    'Transcript of Records': 'PENDING',
    'Birth Certificate': 'PENDING',
    'Application Form': 'PENDING'
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const [mandatoryDocFiles, setMandatoryDocFiles] = useState<Record<string, string>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editVideoRef = useRef<HTMLVideoElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const csvInputRef = useRef<HTMLInputElement>(null);
  const importTriggerRef = useRef<HTMLButtonElement>(null);
  const importDialogRef = useRef<HTMLDivElement>(null);
  const importDialogTitleRef = useRef<HTMLHeadingElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const tesdaPhotoInputRef = useRef<HTMLInputElement>(null);

  const closeImportModal = () => {
    if (isImporting) return;
    setShowImportModal(false);
    window.setTimeout(() => importTriggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (showImportModal) importDialogTitleRef.current?.focus();
  }, [showImportModal]);

  const handleImportDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeImportModal();
      return;
    }
    if (event.key !== 'Tab' || !importDialogRef.current) return;
    const focusable = Array.from(importDialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) {
      event.preventDefault();
      importDialogTitleRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === importDialogTitleRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const defaultFormData: Partial<Student> = {
    uli: '', lastName: '', firstName: '', middleName: '', extension: '', sex: 'Male',
    dateOfBirth: '', birthRegion: '', birthProvince: '', birthCity: '',
    civilStatus: 'Single', educationalAttainment: 'College Graduate', nationality: 'Filipino',
    email: '', contactNumber: '', street: '', barangay: '', city: '', district: '',
    province: '', guardian: '',
  };

  const [formData, setFormData] = useState<Partial<Student>>(defaultFormData);

  const normalizePsgcRows = (rows: any[]): PsgcArea[] =>
    rows
      .map(row => ({
        psgc_code: String(row.psgc_code || row.code || ''),
        area_name: String(row.area_name || row.name || ''),
        reg: Number(row.reg || 0),
        prv: Number(row.prv || 0),
        mun: Number(row.mun || 0),
        bgy: Number(row.bgy || 0),
      }))
      .filter(row => row.psgc_code && row.area_name);

  const fetchPsgcAreas = async (level: 'regions' | 'provinces' | 'municipalities' | 'barangays', params: Record<string, string | number> = {}) => {
    if (!PSGC_TOKEN) return [];

    const url = `${PSGC_BASE_URL}/${PSGC_VERSION}/${level}?${new URLSearchParams({
      token: PSGC_TOKEN,
      page_size: '1000',
      ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
    }).toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`PSGC ${level} request failed (${response.status})`);
    }
    const payload = await response.json();
    const rows = payload?.results?.psgc_data || payload?.psgc_data || payload?.results || [];
    return Array.isArray(rows) ? normalizePsgcRows(rows) : [];
  };

  useEffect(() => {
    if (!showModal || !PSGC_TOKEN || psgcRegions.length > 0) return;

    let isActive = true;
    setPsgcLoading(true);
    setPsgcError(null);
    fetchPsgcAreas('regions')
      .then(rows => {
        if (isActive) setPsgcRegions(rows);
      })
      .catch(error => {
        if (isActive) setPsgcError(error instanceof Error ? error.message : 'Unable to load PSGC regions.');
      })
      .finally(() => {
        if (isActive) setPsgcLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [showModal, psgcRegions.length]);

  useEffect(() => {
    if (!selectedPsgcRegion || !PSGC_TOKEN) return;
    const region = psgcRegions.find(area => area.psgc_code === selectedPsgcRegion);
    if (!region) return;

    let isActive = true;
    setPsgcLoading(true);
    setPsgcError(null);
    setPsgcProvinces([]);
    setPsgcCities([]);
    setPsgcBarangays([]);
    setSelectedPsgcProvince('');
    setSelectedPsgcCity('');
    fetchPsgcAreas('provinces', { reg: region.reg, regionCode: region.psgc_code })
      .then(async rows => {
        if (!isActive) return;
        setPsgcProvinces(rows);
        if (rows.length === 0) {
          setFormData(prev => ({ ...prev, province: region.area_name }));
          const cities = await fetchPsgcAreas('municipalities', { reg: region.reg, regionCode: region.psgc_code });
          if (isActive) setPsgcCities(cities);
        }
      })
      .catch(error => {
        if (isActive) setPsgcError(error instanceof Error ? error.message : 'Unable to load PSGC provinces.');
      })
      .finally(() => {
        if (isActive) setPsgcLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [selectedPsgcRegion, psgcRegions]);

  useEffect(() => {
    if (!selectedPsgcProvince || !PSGC_TOKEN) return;
    const province = psgcProvinces.find(area => area.psgc_code === selectedPsgcProvince);
    if (!province) return;

    let isActive = true;
    setPsgcLoading(true);
    setPsgcError(null);
    setPsgcCities([]);
    setPsgcBarangays([]);
    setSelectedPsgcCity('');
    fetchPsgcAreas('municipalities', { reg: province.reg, prv: province.prv, provinceCode: province.psgc_code })
      .then(rows => {
        if (isActive) setPsgcCities(rows);
      })
      .catch(error => {
        if (isActive) setPsgcError(error instanceof Error ? error.message : 'Unable to load PSGC cities/municipalities.');
      })
      .finally(() => {
        if (isActive) setPsgcLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [selectedPsgcProvince, psgcProvinces]);

  useEffect(() => {
    if (!selectedPsgcCity || !PSGC_TOKEN) return;
    const city = psgcCities.find(area => area.psgc_code === selectedPsgcCity);
    if (!city) return;

    let isActive = true;
    setPsgcLoading(true);
    setPsgcError(null);
    setPsgcBarangays([]);
    fetchPsgcAreas('barangays', { reg: city.reg, prv: city.prv, mun: city.mun, cityCode: city.psgc_code })
      .then(rows => {
        if (isActive) setPsgcBarangays(rows);
      })
      .catch(error => {
        if (isActive) setPsgcError(error instanceof Error ? error.message : 'Unable to load PSGC barangays.');
      })
      .finally(() => {
        if (isActive) setPsgcLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [selectedPsgcCity, psgcCities]);

  const serverFetchEnabled = Boolean(orgId) && viewMode === 'all' && complianceFilter === 'ALL';

  const studentFilters = useMemo(() => {
    const filters: PageFilter[] = [];
    if (orgId) {
      filters.push({ column: 'org_id', operator: 'eq', value: orgId });
    }
    return filters;
  }, [orgId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, orgId, viewMode, selectedBatchId, complianceFilter]);

  useEffect(() => {
    if (!serverFetchEnabled) return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<Student>('students', {
      page: currentPage,
      pageSize: PAGE_SIZE,
      columns: STUDENT_COLUMNS,
      filters: studentFilters,
      search: debouncedSearchTerm.trim()
        ? {
          columns: ['first_name', 'last_name', 'middle_name', 'uli', 'email', 'contact_number', 'city', 'province'],
          term: debouncedSearchTerm
        }
        : undefined,
      orderBy: [
        { column: 'last_name', ascending: true },
        { column: 'first_name', ascending: true }
      ]
    })
      .then(result => {
        if (!isActive) return;
        setServerStudents(result.rows.map(normalizeStudentRecord));
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[StudentsView] Failed to load student page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load learners.');
        setServerStudents([]);
        setServerTotal(0);
        setServerTotalPages(1);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingPage(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [currentPage, debouncedSearchTerm, serverFetchEnabled, studentFilters]);
  // Optimized filtering with useMemo
  const filteredStudents = useMemo(() => {
    let base = students;

    // If viewing by batch and a batch is selected, filter to only that batch's students
    if (viewMode === 'batch' && selectedBatchId) {
      const batch = batches.find(b => b.id === selectedBatchId);
      if (batch) {
        const batchStudentIds = new Set(batch.studentIds);
        base = base.filter(s => batchStudentIds.has(s.id));
      }
    }

    if (complianceFilter !== 'ALL') {
      base = base.filter(student => {
        if (complianceFilter === 'PROVISIONAL') {
          return isProvisionalStudent(student);
        }
        if (isProvisionalStudent(student)) {
          return false;
        }
        const docs = getComplianceDocuments(student);
        const verifiedCount = docs.filter(d => d.status === 'VERIFIED').length;
        const pendingCount = docs.filter(d => d.status === 'PENDING' || d.status === 'UPLOADED').length;
        const isCompliant = docs.length > 0 ? verifiedCount === docs.length || student.isEnrollmentOverridden : false;
        if (complianceFilter === 'COMPLIANT') return isCompliant;
        if (complianceFilter === 'PENDING') return pendingCount > 0 && !isCompliant;
        if (complianceFilter === 'REJECTED') return docs.some(d => d.status === 'REJECTED');
        return true;
      });
    }

    if (debouncedSearchTerm) {
      const lower = debouncedSearchTerm.toLowerCase();
      base = base.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(lower) ||
        (s.uli || '').toLowerCase().includes(lower)
      );
    }

    return [...base].sort((a, b) =>
      `${a.lastName} ${a.firstName} ${a.middleName || ''}`.localeCompare(
        `${b.lastName} ${b.firstName} ${b.middleName || ''}`,
        undefined,
        { sensitivity: 'base' }
      )
    );
  }, [students, debouncedSearchTerm, viewMode, selectedBatchId, complianceFilter, batches]);

  // Pagination
  const fallbackTotalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const fallbackPaginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  const useFallbackRows = !serverFetchEnabled || !!pageLoadError;
  const paginatedStudents = useFallbackRows ? fallbackPaginatedStudents : serverStudents;
  const totalItems = useFallbackRows ? filteredStudents.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const activePage = Math.min(currentPage, totalPages);
  const handlePageChange = (page: number | ((currentPage: number) => number)) => {
    setCurrentPage(prev => typeof page === 'function' ? page(prev) : page);
  };

  // Reset page when search or filter changes
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm.trim().length > 0 || complianceFilter !== 'ALL' || viewMode === 'batch';

  const handleSelectBatch = (batchId: string) => {
    setSelectedBatchId(batchId);
    setCurrentPage(1);
  };

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  const downloadTemplate = () => {
    const encodedUri = `data:text/csv;charset=utf-8,${encodeURIComponent(createLearnerCsvTemplate())}`;
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Learner_Batch_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = readLearnerCsv(event.target?.result as string, students);
      const studentData = result.students.map((student, index) => ({
        ...student,
        documents: MANDATORY_DOCS.map((doc, dIdx) => ({
          id: `doc-${dIdx}-${Date.now()}-${index}`, name: doc, status: 'PENDING' as const
        }))
      }));
      setImportPreview(studentData);
      setImportErrors(result.errors);
      setImportTotalRows(result.totalRows);
      setShowImportModal(true);
      if (csvInputRef.current) csvInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const commitBatch = async () => {
    if (importErrors.length || !importPreview.length || isImporting) return;
    setIsImporting(true);
    try {
      await onBatchAddStudents(importPreview);
      showToast(`${importPreview.length} learners imported successfully!`, 'success');
      setImportPreview([]);
      setImportErrors([]);
      setShowImportModal(false);
      window.setTimeout(() => importTriggerRef.current?.focus(), 0);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to import learners.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDocumentAudit = (docId: string, action: 'VERIFY' | 'REJECT') => {
    if (!auditStudent) return;
    try {
      const nextDocs = auditStudent.documents.map(d =>
        d.id === docId ? { ...d, status: action === 'VERIFY' ? 'VERIFIED' as const : 'REJECTED' as const } : d
      );
      const updated = { ...auditStudent, documents: nextDocs };
      onUpdateStudent(updated);
      setAuditStudent(updated);
      const docName = auditStudent.documents.find(d => d.id === docId)?.name || 'Document';
      showToast(`${docName} ${action === 'VERIFY' ? 'verified' : 'rejected'} successfully!`, 'success');
    } catch (error) {
      showToast(`Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const openDocumentPreview = (doc: StudentDocument) => {
    if (!doc.fileData) return;

    if (/^https?:\/\//.test(doc.fileData)) {
      window.open(doc.fileData, '_blank', 'noopener,noreferrer');
      return;
    }

    if (doc.fileData.startsWith('data:')) {
      const [metadata, base64Data] = doc.fileData.split(',');
      const mimeType = metadata.split(':')[1]?.split(';')[0] || 'application/octet-stream';
      const binary = atob(base64Data || '');
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    }

    const fallbackUrl = `data:application/octet-stream;base64,${doc.fileData}`;
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
  };

  const handleToggleOverride = () => {
    if (!auditStudent) return;
    try {
      const updated = { ...auditStudent, isEnrollmentOverridden: !auditStudent.isEnrollmentOverridden };
      onUpdateStudent(updated);
      setAuditStudent(updated);
      showToast(`Enrollment override ${updated.isEnrollmentOverridden ? 'enabled' : 'disabled'} successfully!`, 'success');
    } catch (error) {
      showToast(`Failed to update enrollment override: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const openEditStudent = (student: Student, closeView = false) => {
    const normalizedStudent = normalizeStudentRecord(student);
    setEditingStudent(normalizedStudent);
    setFormData(normalizedStudent);
    setShowEditModal(true);
    if (closeView) setAuditStudent(null);
  };

  const handlePrintLearnerProfile = (student: Student) => {
    const batch = batches.find(item => item.studentIds?.includes(student.id));
    const qualification = qualifications.find(item => item.id === batch?.qualificationId);
    const courseName = qualification?.name || batch?.name || '';
    const printWindow = window.open('', '_blank', 'width=900,height=1200');

    if (!printWindow) {
      showToast('Please allow popups to print the learner profile form.', 'error');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildLearnerProfilePrintHtml(student, courseName));
    printWindow.document.close();
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dob = e.target.value;
    const age = new Date().getFullYear() - new Date(dob).getFullYear();
    setFormData({ ...formData, dateOfBirth: dob, age: Math.max(0, age) });
  };

  const startCamera = () => {
    setShowCamera(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        alert("Camera access denied.");
        setShowCamera(false);
      }
    }, 100);
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setPhotoPreview(dataUrl);
        stopCamera();
      }
    }
  };

  const handleDocumentUpload = (docName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['docx', 'pdf', 'png', 'jpeg', 'jpg'];
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg'
    ];
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(fileExtension) || !allowedMimeTypes.includes(file.type)) {
      showToast('Unsupported file type. Allowed: DOCX, PDF, PNG, JPEG, JPG.', 'error');
      if (e.target) e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setMandatoryDocStatuses(prev => ({ ...prev, [docName]: 'UPLOADED' }));
      setMandatoryDocFiles(prev => ({ ...prev, [docName]: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}`;
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const resetRegistrationDraft = () => {
    setFormData(defaultFormData);
    setMandatoryDocStatuses({
      'Transcript of Records': 'PENDING',
      'Birth Certificate': 'PENDING',
      'Application Form': 'PENDING'
    });
    setMandatoryDocFiles({});
    setPhotoPreview(null);
    setSelectedPsgcRegion('');
    setSelectedPsgcProvince('');
    setSelectedPsgcCity('');
    setPsgcProvinces([]);
    setPsgcCities([]);
    setPsgcBarangays([]);
  };

  const buildRegistrationStudent = (): Student => {
    const documents: StudentDocument[] = MANDATORY_DOCS.map((doc, idx) => ({
      id: `doc-${idx}-${Date.now()}`,
      name: doc,
      status: mandatoryDocStatuses[doc],
      fileData: mandatoryDocFiles[doc]
    }));

    return {
      ...formData as Student,
      id: `stud-${Date.now()}`,
      orgId: 'temp',
      profilePhoto: photoPreview || undefined,
      documents,
      createdAt: new Date().toISOString()
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onAddStudent(buildRegistrationStudent());
      showToast(`Student ${formData.firstName} ${formData.lastName} registered successfully!`, 'success');
      setShowModal(false);
      resetRegistrationDraft();
    } catch (error) {
      showToast(`Failed to register student: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    setShowModal(false);
  };

  const handleTesdaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onAddStudent(buildRegistrationStudent());
      showToast(`TESDA form entry for ${formData.firstName} ${formData.lastName} registered successfully!`, 'success');
      setShowTesdaForm(false);
      resetRegistrationDraft();
    } catch (error) {
      showToast(`Failed to register TESDA form entry: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {!auditStudent && !showModal && !showTesdaForm && !(showEditModal && editingStudent) && (
        <>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Student Information System</h2>
          <p className="text-sm text-gray-500 font-normal italic">Institutional Compliance & Enrollment Oversight (v4.0.1)</p>
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setViewMode('all'); setSelectedBatchId(null); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-all border ${viewMode === 'all'
                ? 'bg-brand text-white border-brand shadow-md'
                : 'bg-white text-gray-500 border-gray-200 hover:border-brand hover:text-brand'
                }`}
              style={viewMode === 'all' ? { backgroundColor: brandColor, borderColor: brandColor, boxShadow: `0 10px 20px ${withAlpha(brandColor, 0.22)}` } : undefined}
            >
              <Users size={14} /> All Learners
            </button>
            <button
              onClick={() => { setViewMode('batch'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-all border ${viewMode === 'batch'
                ? 'bg-brand text-white border-brand shadow-md'
                : 'bg-white text-gray-500 border-gray-200 hover:border-brand hover:text-brand'
                }`}
              style={viewMode === 'batch' ? { backgroundColor: brandColor, borderColor: brandColor, boxShadow: `0 10px 20px ${withAlpha(brandColor, 0.22)}` } : undefined}
            >
              <Layers size={14} /> By Batch
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditStudent && (
              <>
            <button title="Includes one clearly marked example row. Remove it or leave it unchanged; it will never be imported." onClick={downloadTemplate} className="flex items-center gap-2 px-3 py-2.5 text-slate-500 hover:text-brand transition-colors text-xs font-semibold uppercase tracking-wide border border-gray-200 rounded-md bg-white h-10">
              <Download size={14} /> Template + Example
            </button>
            <input type="file" ref={csvInputRef} className="hidden" accept=".csv" onChange={handleCsvFileChange} />
            <button
              ref={importTriggerRef}
              title="Required: last name, first name, email, and date of birth in YYYY-MM-DD format. ULI is optional."
              onClick={() => csvInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2.5 rounded border text-xs font-semibold h-10 transition-all"
              style={{ backgroundColor: withAlpha(brandColor, 0.1), color: brandColor, borderColor: withAlpha(brandColor, 0.22) }}
            >
              <FileSpreadsheet size={14} style={{ color: brandColor }} /> MIS Batch
            </button>
            <button
              onClick={() => {
                resetRegistrationDraft();
                setShowTesdaForm(true);
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded border text-xs font-semibold h-10 transition-all bg-white text-gray-600 hover:text-brand hover:border-brand"
            >
              <FileText size={14} /> TESDA Form Entry
            </button>
              </>
            )}
            {canCreateStudent && (
            <button onClick={() => {
              resetRegistrationDraft();
              setShowModal(true);
            }} className="flex items-center gap-2 px-3 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-sm text-xs font-semibold h-10" style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px ${withAlpha(brandColor, 0.2)}` }}>
              <Plus size={14} /> Register Learner
            </button>
            )}
          </div>
        </div>
      </div>

      {/* Batch Selector Panel - only in batch mode */}
      {viewMode === 'batch' && (
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} style={{ color: brandColor }} />
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Select a Training Batch</h3>
          </div>
          {batches.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4 text-center">No batches found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {batches.map(batch => {
                const qual = qualifications.find(q => q.id === batch.qualificationId);
                const isSelected = selectedBatchId === batch.id;
                return (
                  <button
                    key={batch.id}
                    onClick={() => handleSelectBatch(batch.id)}
                    className={`text-left p-4 rounded border transition-all group ${isSelected
                      ? 'bg-brand text-white border-brand shadow-md'
                      : 'bg-gray-50 border-gray-200 hover:border-brand hover:shadow-sm'
                      }`}
                    style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor, boxShadow: `0 10px 20px ${withAlpha(brandColor, 0.18)}` } : undefined}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-white/80' : 'text-brand'}`} style={!isSelected ? { color: brandColor } : undefined}>
                        FY {batch.year}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                        <Users size={12} /> {batch.studentIds.length}
                      </span>
                    </div>
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>{batch.name}</p>
                    <p className={`text-xs truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                      <Award size={10} className="inline mr-1" />{qual?.name || 'Unknown'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Batch Info Header */}
      {viewMode === 'batch' && selectedBatch && (
        <div className="rounded-md border p-4 flex items-center justify-between" style={{ background: `linear-gradient(90deg, ${withAlpha(brandColor, 0.08)}, ${withAlpha(brandColor, 0.16)})`, borderColor: withAlpha(brandColor, 0.2) }}>
          <div className="flex items-center gap-4">
            <div className="p-3 text-white rounded shadow-sm" style={{ backgroundColor: brandColor }}>
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">{selectedBatch.name}</h3>
              <p className="text-xs text-gray-500">
                {qualifications.find(q => q.id === selectedBatch.qualificationId)?.name || 'Unknown'}
                {' � '}{selectedBatch.studentIds.length} enrolled � {selectedBatch.startDate} to {selectedBatch.endDate}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setSelectedBatchId(null); setCurrentPage(1); }}
            className="text-xs font-semibold text-gray-400 hover:text-brand transition-colors flex items-center gap-1"
          >
            <X size={14} /> Clear
          </button>
        </div>
      )}

      <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr_1fr] items-end">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              placeholder="Search by name or ULI..."
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none transition-all"
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={18} />
            <select
              value={complianceFilter}
              onChange={e => { setComplianceFilter(e.target.value as any); setCurrentPage(1); }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-gray-700 focus:border-brand outline-none transition-all"
            >
              <option value="ALL">All compliance statuses</option>
              <option value="PROVISIONAL">Billed by AR (Pending Registration)</option>
              <option value="COMPLIANT">Compliant</option>
              <option value="PENDING">Pending docs</option>
              <option value="REJECTED">Rejected docs</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setComplianceFilter('ALL');
                setViewMode('all');
                setSelectedBatchId(null);
              }}
              className={`text-sm font-semibold transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            >
              Clear filters
            </button>
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-900">{totalItems}</span> of <span className="font-semibold text-gray-900">{useFallbackRows ? students.length : serverTotal}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Provisional Learners Alert Banner */}
      {provisionalStudentsCount > 0 && complianceFilter !== 'PROVISIONAL' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {provisionalStudentsCount} unregistered learner{provisionalStudentsCount > 1 ? 's were' : ' was'} billed by AR and require{provisionalStudentsCount === 1 ? 's' : ''} official registration.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setComplianceFilter('PROVISIONAL');
              setCurrentPage(1);
            }}
            className="px-3 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-xs"
          >
            Review Provisional Learners
          </button>
        </div>
      )}

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-brand border-b">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Learner Identification</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Compliance Status</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Residence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-16 text-center">
                  <Users size={32} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400 font-semibold">
                    {isLoadingPage && !useFallbackRows ? 'Loading learners...' : viewMode === 'batch' && !selectedBatchId ? 'Select a batch above to view its enrolled learners.' : 'No learners found matching your criteria.'}
                  </p>
                </td>
              </tr>
            ) : paginatedStudents.map(student => {
              const complianceDocuments = getComplianceDocuments(student);
              const pendingDocs = complianceDocuments.filter(d => d.status === 'UPLOADED').length;
              const verifiedDocs = complianceDocuments.filter(d => d.status === 'VERIFIED').length;
              const isCompliant = verifiedDocs === complianceDocuments.length || student.isEnrollmentOverridden;

              return (
                <tr
                  key={student.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setAuditStudent(normalizeStudentRecord(student))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setAuditStudent(normalizeStudentRecord(student));
                    }
                  }}
                  className="hover:bg-gray-50 transition-colors group cursor-pointer focus:outline-none focus:bg-gray-50"
                  title="View learner record"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded overflow-hidden flex items-center justify-center border shadow-sm shrink-0" style={{ backgroundColor: withAlpha(brandColor, 0.1), borderColor: withAlpha(brandColor, 0.18) }}>
                        {getStudentProfilePhoto(student) ? (
                          <img src={getStudentProfilePhoto(student)} alt="S" className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle size={24} style={{ color: withAlpha(brandColor, 0.75) }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-800 leading-tight">
                            {student.lastName.toUpperCase()}, {student.firstName}
                          </div>
                          {isProvisionalStudent(student) && (
                            <span className="shrink-0 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                              Billed by AR (Provisional)
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono font-bold mt-1 uppercase" style={{ color: brandColor }}>
                          {isProvisionalStudent(student) ? (
                            <span className="text-amber-600 font-sans font-medium">Pending Registration</span>
                          ) : (
                            `ULI: ${student.uli || '—'}`
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      {isProvisionalStudent(student) ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-fit">
                            <Clock size={10} /> Pending Full Registration
                          </span>
                          {canEditStudent && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditStudent(student);
                              }}
                              className="px-2 py-0.5 text-xs font-semibold text-brand hover:text-brand-hover bg-brand/10 hover:bg-brand/20 rounded border border-brand/30 transition-colors"
                            >
                              Complete Registration
                            </button>
                          )}
                        </div>
                      ) : isCompliant ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand-light w-fit">
                          <Check size={10} /> Qualified
                        </span>
                      ) : pendingDocs > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand-light w-fit animate-pulse">
                          <ShieldAlert size={10} /> {pendingDocs} Audit Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 w-fit">
                          Incomplete
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-xs text-gray-600 font-bold leading-tight">{student.city}</div>
                    <div className="text-xs text-gray-400 font-medium uppercase tracking-tighter">{student.province}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalItems > PAGE_SIZE && (
        <div className="bg-white px-6 py-4 rounded-md border border-gray-200 shadow-sm flex items-center justify-between">
          <p className="text-xs text-gray-400 font-semibold">
            Page {activePage} of {totalPages} {isLoadingPage && !useFallbackRows ? '(loading...)' : ''}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={activePage === 1}
              className="p-2 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="First page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={() => handlePageChange(p => Math.max(1, p - 1))}
              disabled={activePage === 1}
              className="p-2 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - activePage) <= 2)
              .reduce<(number | 'dots')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('dots');
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'dots' ? (
                  <span key={`dots-${idx}`} className="px-1 text-gray-300 text-xs">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => handlePageChange(item as number)}
                    className={`w-8 h-8 rounded text-xs font-semibold transition-all ${activePage === item
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    style={activePage === item ? { backgroundColor: brandColor } : undefined}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => handlePageChange(p => Math.min(totalPages, p + 1))}
              disabled={activePage === totalPages}
              className="p-2 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={activePage === totalPages}
              className="p-2 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* Batch Import Preview Modal */}
      {showImportModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div
            ref={importDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="learner-import-title"
            aria-describedby="learner-import-description"
            onKeyDown={handleImportDialogKeyDown}
            className="bg-white rounded-md shadow-md w-full max-w-6xl overflow-hidden animate-in zoom-in duration-300 border border-gray-200 my-8 flex flex-col h-full max-h-[90vh]"
          >
            <div className="p-8 border-b bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-600 text-white rounded shadow-sm shadow-emerald-100"><FileSpreadsheet size={24} /></div>
                <div>
                  <h3 ref={importDialogTitleRef} tabIndex={-1} id="learner-import-title" className="text-lg font-semibold text-gray-800 uppercase tracking-tight focus:outline-none">Batch Import Preview</h3>
                  <p id="learner-import-description" className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-1">Found {importTotalRows} learner records. Review validation before committing.</p>
                </div>
              </div>
              <button aria-label="Close import preview" onClick={closeImportModal} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={28} /></button>
            </div>

            <div className="px-8 py-4 border-b border-gray-100 bg-white">
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                <span className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                  {importPreview.length} valid
                </span>
                <span className={`px-3 py-2 border rounded ${importErrors.length ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                  {importInvalidRows} invalid ({importErrors.length} {importErrors.length === 1 ? 'error' : 'errors'})
                </span>
                <span className="px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                  Required: Last Name, First Name, E-mail Address, Date of Birth (YYYY-MM-DD). ULI is optional.
                </span>
              </div>
              {importErrors.length > 0 && (
                <div className="mt-4 max-h-36 overflow-y-auto border border-rose-200 bg-rose-50 rounded" role="alert">
                  {importErrors.map((error, index) => (
                    <div key={`${error.row}-${error.field}-${index}`} className="flex gap-3 px-4 py-2 text-xs border-b last:border-b-0 border-rose-100">
                      <span className="font-bold text-rose-800 shrink-0">
                        {error.row === 1 ? (error.field === 'CSV' ? 'File' : 'Header') : `Row ${error.row}`}
                      </span>
                      <span className="font-semibold text-rose-700 shrink-0">{error.field}</span>
                      <span className="text-rose-700">{error.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-0">
              <table className="min-w-max w-full border-collapse text-xs">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {LEARNER_CSV_HEADERS.map(header => (
                      <th key={header} scope="col" className="whitespace-nowrap border-b border-r border-gray-200 px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {importPreview.map((p, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-gray-50/60 hover:bg-emerald-50/50 transition-colors">
                      {[
                        p.lastName, p.firstName, p.middleName, p.extension, p.uli, p.contactNumber,
                        p.email, p.street, p.barangay, p.city, p.district, p.province, p.sex,
                        p.dateOfBirth, p.age, p.civilStatus, p.educationalAttainment, p.nationality
                      ].map((value, columnIndex) => (
                        <td key={LEARNER_CSV_HEADERS[columnIndex]} className="whitespace-nowrap border-b border-r border-gray-100 px-3 py-2.5 font-medium text-gray-700">
                          {value === undefined || value === null || value === '' ? <span className="text-gray-400">—</span> : String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-8 bg-gray-800 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-white/5">
              <div className="flex items-center gap-4 text-white">
                <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center border border-white/10">
                  <ShieldCheck size={24} className="text-brand" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-tight">Integrity Verification</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mt-1">Full registry alignment checked against institutional schema.</p>
                </div>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button disabled={isImporting} onClick={closeImportModal} className="flex-1 px-8 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-white transition-colors disabled:opacity-50">Discard Batch</button>
                <button
                  disabled={importErrors.length > 0 || !importPreview.length || isImporting}
                  onClick={commitBatch}
                  className="flex-1 px-12 py-4 bg-brand text-white rounded-md text-xs font-semibold uppercase tracking-wide shadow-md shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all disabled:bg-gray-600 disabled:text-gray-400 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing…' : `Commit ${importPreview.length} Records`}
                </button>
              </div>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* TESDA Learner Form Entry Page */}
      {showTesdaForm && (
        <TesdaLearnerFormEntry
          formData={formData}
          setFormData={setFormData}
          photoPreview={photoPreview}
          setPhotoPreview={setPhotoPreview}
          brandColor={brandColor}
          courseName={qualifications[0]?.name || ''}
          onBack={() => { setShowTesdaForm(false); resetRegistrationDraft(); }}
          onSubmit={handleTesdaSubmit}
        />
      )}
      {/* Student View Page */}
      {auditStudent && (
        <div className="bg-white rounded-md shadow-sm w-full overflow-hidden animate-in fade-in duration-300 border border-gray-200">
            <div className="p-8 border-b bg-gray-50 flex flex-col lg:flex-row justify-between gap-5 lg:items-center shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded overflow-hidden bg-white border-4 border-white shadow-sm flex items-center justify-center shrink-0">
                  {getStudentProfilePhoto(auditStudent) ? (
                    <img src={getStudentProfilePhoto(auditStudent)} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle size={32} className="text-gray-300" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight leading-none mb-1">
                    {auditStudent.lastName.toUpperCase()}, {auditStudent.firstName}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-brand uppercase tracking-wide bg-brand/10 px-2 py-0.5 rounded">ULI: {auditStudent.uli}</span>
                    <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded border ${isProvisionalStudent(auditStudent)
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : (getComplianceDocuments(auditStudent).filter(d => d.status === 'VERIFIED').length === getComplianceDocuments(auditStudent).length || auditStudent.isEnrollmentOverridden)
                      ? 'bg-emerald-50 text-brand border-emerald-100'
                      : 'bg-brand/10 text-brand border-brand-light'
                      }`}>
                      {isProvisionalStudent(auditStudent) ? 'PROVISIONAL (AR BILLED)' : (auditStudent.isEnrollmentOverridden ? 'ADMIN OVERRIDE ACTIVE' : 'STANDARD REGISTRY')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAuditStudent(null)}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors text-xs font-semibold uppercase tracking-wide"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button onClick={() => handlePrintLearnerProfile(auditStudent)} className="p-3 bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-400 hover:text-gray-800 transition-colors" title="Print TESDA learners profile form"><Printer size={20} /></button>
                {canEditStudent && <button
                  onClick={() => openEditStudent(auditStudent, true)}
                  className="inline-flex items-center gap-2 px-4 py-3 text-white rounded text-xs font-semibold uppercase tracking-wide transition-colors shadow-sm"
                  style={{ backgroundColor: isProvisionalStudent(auditStudent) ? '#d97706' : brandColor }}
                >
                  <RefreshCw size={16} /> {isProvisionalStudent(auditStudent) ? 'Complete Registration' : 'Edit'}
                </button>}
              </div>
            </div>

            {isProvisionalStudent(auditStudent) && (
              <div className="mx-5 my-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Billed by AR — Pending Official Registration</p>
                    <p className="text-xs text-amber-700">This learner was created during AR invoice billing. Official ULI, date of birth, address, and TESDA compliance documents are pending.</p>
                  </div>
                </div>
                {canEditStudent && (
                  <button
                    onClick={() => openEditStudent(auditStudent, true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs shrink-0 transition-colors"
                  >
                    Complete Registration
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col md:flex-row">
              {/* Left Column: Comprehensive Profile */}
              <div className="flex-1 p-5 space-y-12 border-r border-gray-100 bg-white">
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand/10 text-brand rounded"><User size={18} /></div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Personal Registry Details</h4>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <DataPoint label="Birth Date" value={auditStudent.dateOfBirth} />
                    <DataPoint label="Sex" value={auditStudent.sex} />
                    <DataPoint label="Civil Status" value={auditStudent.civilStatus} />
                    <DataPoint label="Nationality" value={auditStudent.nationality} />
                    <DataPoint label="Birth Region" value={auditStudent.birthRegion} />
                    <DataPoint label="Birth City" value={auditStudent.birthCity} />
                    <DataPoint label="Educational Attainment" value={auditStudent.educationalAttainment} isSpan2 />
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand/10 text-brand rounded"><MapPin size={18} /></div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Residence & Contact</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <DataPoint label="Official Email" value={auditStudent.email} />
                    <DataPoint label="Contact Number" value={auditStudent.contactNumber} />
                  </div>
                  <div className="p-6 bg-gray-50 rounded-md border border-gray-100">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Detailed Address</div>
                    <p className="text-sm font-bold text-gray-800 uppercase leading-relaxed">
                      {auditStudent.street}, {auditStudent.barangay}, {auditStudent.city}, {auditStudent.district}, {auditStudent.province}
                    </p>
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand/10 text-brand rounded"><Heart size={18} /></div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Family Background</h4>
                  </div>
                  <DataPoint label="Primary Guardian / Parent" value={auditStudent.guardian || 'Not Declared'} />
                </section>
              </div>

              {/* Right Column: Compliance Ledger & Audit */}
              <div className="w-full md:w-[450px] bg-gray-50 p-5 flex flex-col shrink-0">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                    <ShieldCheck size={18} className="text-brand" />
                    Compliance Audit
                  </h4>
                  <button
                    onClick={handleToggleOverride}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${auditStudent.isEnrollmentOverridden
                      ? 'bg-rose-600 text-white shadow-lg'
                      : 'bg-white border border-gray-200 text-gray-400 hover:text-rose-600'
                      }`}
                  >
                    {auditStudent.isEnrollmentOverridden ? 'Revoke Override' : 'Force Qualify'}
                  </button>
                </div>

                <div className="space-y-6">
                  {getComplianceDocuments(auditStudent).map((doc, docIndex) => {
                    const isUploaded = doc.status === 'UPLOADED' || doc.status === 'VERIFIED';
                    const isVerified = doc.status === 'VERIFIED';
                    const isRejected = doc.status === 'REJECTED';

                    return (
                      <div key={`${doc.id}-${doc.name}-${docIndex}`} className={`p-6 rounded border transition-all ${isVerified ? 'bg-emerald-50/50 border-emerald-100 shadow-sm' :
                        isRejected ? 'bg-rose-50 border-rose-100' :
                          isUploaded ? 'bg-white border-orange-100 shadow-sm' : 'bg-gray-100/50 border-gray-200 opacity-60'
                        }`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {isVerified ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0" /> :
                              isRejected ? <ShieldAlert size={20} className="text-rose-500 shrink-0" /> :
                                isUploaded ? <UploadCloud size={20} className="text-orange-500 shrink-0 animate-bounce" /> :
                                  <Clock size={20} className="text-gray-300 shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 uppercase tracking-tight truncate">{doc.name}</p>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Status: {doc.status}</p>
                            </div>
                          </div>
                          {doc.fileData && (
                            <button
                              onClick={() => openDocumentPreview(doc)}
                              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide border border-brand/20 bg-white text-brand rounded-lg hover:bg-brand/5 transition-colors"
                            >
                              <ExternalLink size={14} /> View
                            </button>
                          )}
                        </div>

                        {doc.fileData && doc.status === 'UPLOADED' && (
                          <div className="flex gap-2 pt-4 border-t border-gray-100">
                            <button onClick={() => handleDocumentAudit(doc.id, 'REJECT')} className="flex-1 py-2.5 bg-white border border-rose-100 text-rose-600 rounded text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-rose-600 hover:text-white transition-all">
                              <ThumbsDown size={14} /> Reject
                            </button>
                            <button onClick={() => handleDocumentAudit(doc.id, 'VERIFY')} className="flex-1 py-2.5 bg-emerald-600 text-white rounded text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                              <ThumbsUp size={14} /> Verify
                            </button>
                          </div>
                        )}

                        {isVerified && (
                          <div className="text-xs font-semibold text-brand uppercase italic mt-1 text-center">System Validated � Audit Verified</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-auto pt-10">
                  <div className="bg-gray-800 rounded p-6 text-white shadow-md relative overflow-hidden">
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center border border-white/10">
                        <Shield size={24} className="text-brand" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-brand uppercase tracking-wide">Enrollment Status</p>
                        <p className="text-base font-semibold uppercase">
                          {(getComplianceDocuments(auditStudent).filter(d => d.status === 'VERIFIED').length === getComplianceDocuments(auditStudent).length || auditStudent.isEnrollmentOverridden)
                            ? 'Qualified for Deployment'
                            : 'Incomplete Compliance'}
                        </p>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <CheckCircle size={100} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* Register Learner Page */}
      {showModal && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ background: `linear-gradient(90deg, ${withAlpha(brandColor, 0.08)}, ${withAlpha(brandColor, 0.14)})` }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 text-white rounded shadow-sm" style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px ${withAlpha(brandColor, 0.18)}` }}><User size={18} /></div>
                <div>
                  <h3 className="text-base font-semibold text-gray-800 uppercase tracking-tight">Register Learner</h3>
                  <p className="text-xs font-semibold text-gray-500 mt-1">Create a learner profile and attach initial compliance documents.</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors text-xs font-semibold uppercase tracking-wide">
                <ChevronLeft size={16} /> Back
              </button>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-7 pb-4 [&_input]:px-3 [&_input]:py-2.5 [&_select]:px-3 [&_select]:py-2.5 [&_input]:text-sm [&_select]:text-sm">
                <div
                  className="flex items-start gap-3 rounded border px-4 py-3"
                  style={{ borderColor: withAlpha(brandColor, 0.22), backgroundColor: withAlpha(brandColor, 0.055) }}
                  role="note"
                  aria-label="Required fields information"
                >
                  <AlertCircle size={17} className="mt-0.5 shrink-0" style={{ color: brandColor }} />
                  <div>
                    <p className="text-xs font-semibold text-gray-700">
                      Only Last Name and First Name are required
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-gray-500">All other learner details can be completed later.</p>
                  </div>
                </div>

                {/* 1. Personal Identity */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500"><Fingerprint size={14} /></div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Personal Identification</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">ULI (Learner ID)</label>
                      <input placeholder="24-XXX-XXX-XXXX" className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-semibold text-brand font-mono" value={formData.uli} onChange={e => setFormData({ ...formData, uli: e.target.value })} />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Last Name <span className="text-red-500">*</span></label>
                      <input required className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">First Name <span className="text-red-500">*</span></label>
                      <input required className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Middle</label>
                      <input className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.middleName} onChange={e => setFormData({ ...formData, middleName: e.target.value })} />
                    </div>
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Ext.</label>
                      <input placeholder="Jr" className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.extension} onChange={e => setFormData({ ...formData, extension: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Birth Date</label>
                      <input type="date" className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.dateOfBirth} onChange={handleDobChange} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Computed Age</label>
                      <input readOnly className="w-full bg-gray-100 border border-gray-100 rounded font-semibold text-gray-500" value={formData.age} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Sex</label>
                      <select className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.sex} onChange={e => setFormData({ ...formData, sex: e.target.value as any })}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Civil Status</label>
                      <select className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.civilStatus} onChange={e => setFormData({ ...formData, civilStatus: e.target.value })}>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Separated">Separated</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* 2. Contact & Address */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500"><MapPin size={14} /></div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact & Residence</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Institutional Email</label>
                      <input type="email" placeholder="learner@manila.edu.ph" className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Contact Number</label>
                      <input placeholder="09XX XXX XXXX" className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.contactNumber} onChange={e => setFormData({ ...formData, contactNumber: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-6 space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">House # / Street</label>
                      <input placeholder="Kalsada St. / Bldg 123" className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.street} onChange={e => setFormData({ ...formData, street: e.target.value })} />
                    </div>
                    <div className="md:col-span-6 space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Region</label>
                      {PSGC_TOKEN ? (
                        <select
                          className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800"
                          value={selectedPsgcRegion}
                          onChange={e => {
                            const region = psgcRegions.find(area => area.psgc_code === e.target.value);
                            setSelectedPsgcRegion(e.target.value);
                            setFormData(prev => ({ ...prev, district: region?.area_name || '', province: '', city: '', barangay: '' }));
                          }}
                        >
                          <option value="">{psgcLoading && psgcRegions.length === 0 ? 'Loading regions...' : 'Select region...'}</option>
                          {psgcRegions.map(region => <option key={region.psgc_code} value={region.psgc_code}>{region.area_name}</option>)}
                        </select>
                      ) : (
                        <input className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.district || ''} onChange={e => setFormData({ ...formData, district: e.target.value })} placeholder="Region" />
                      )}
                    </div>
                  </div>
                  {PSGC_TOKEN && (
                    <div className="rounded border border-brand-light bg-brand/10 px-4 py-3 text-xs font-semibold text-brand">
                      PSGC address data is loaded from the official PSA Classification API. {psgcLoading ? 'Loading address options...' : psgcError || 'Choose each level from left to right.'}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Province</label>
                      {PSGC_TOKEN ? (
                        <select disabled={!selectedPsgcRegion || psgcProvinces.length === 0} className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800 disabled:opacity-60" value={selectedPsgcProvince} onChange={e => {
                          const province = psgcProvinces.find(area => area.psgc_code === e.target.value);
                          setSelectedPsgcProvince(e.target.value);
                          setFormData(prev => ({ ...prev, province: province?.area_name || '', city: '', barangay: '' }));
                        }}>
                          <option value="">{psgcProvinces.length === 0 ? 'No province / use region' : 'Select province...'}</option>
                          {psgcProvinces.map(province => <option key={province.psgc_code} value={province.psgc_code}>{province.area_name}</option>)}
                        </select>
                      ) : (
                        <input className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.province} onChange={e => setFormData({ ...formData, province: e.target.value })} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">City / Municipality</label>
                      {PSGC_TOKEN ? (
                        <select disabled={!selectedPsgcRegion || psgcCities.length === 0} className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800 disabled:opacity-60" value={selectedPsgcCity} onChange={e => {
                          const city = psgcCities.find(area => area.psgc_code === e.target.value);
                          setSelectedPsgcCity(e.target.value);
                          setFormData(prev => ({ ...prev, city: city?.area_name || '', barangay: '' }));
                        }}>
                          <option value="">{psgcLoading && psgcCities.length === 0 ? 'Loading cities...' : 'Select city/municipality...'}</option>
                          {psgcCities.map(city => <option key={city.psgc_code} value={city.psgc_code}>{city.area_name}</option>)}
                        </select>
                      ) : (
                        <input className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Barangay</label>
                      {PSGC_TOKEN ? (
                        <select disabled={!selectedPsgcCity || psgcBarangays.length === 0} className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800 disabled:opacity-60" value={formData.barangay || ''} onChange={e => {
                          const barangay = psgcBarangays.find(area => area.area_name === e.target.value);
                          setFormData(prev => ({ ...prev, barangay: barangay?.area_name || e.target.value }));
                        }}>
                          <option value="">{psgcLoading && psgcBarangays.length === 0 ? 'Loading barangays...' : 'Select barangay...'}</option>
                          {psgcBarangays.map(barangay => <option key={barangay.psgc_code} value={barangay.area_name}>{barangay.area_name}</option>)}
                        </select>
                      ) : (
                        <input className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.barangay} onChange={e => setFormData({ ...formData, barangay: e.target.value })} />
                      )}
                    </div>
                  </div>
                </section>

                {/* 3. Education & Guardian */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500"><BookOpen size={14} /></div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Background & Guardian</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Educational Attainment</label>
                      <select className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.educationalAttainment} onChange={e => setFormData({ ...formData, educationalAttainment: e.target.value })}>
                        <option value="Elementary Graduate">Elementary Graduate</option>
                        <option value="High School Graduate">High School Graduate</option>
                        <option value="College Level">College Level</option>
                        <option value="College Graduate">College Graduate</option>
                        <option value="TVET Graduate">TVET Graduate</option>
                        <option value="Masteral/PhD">Masteral/PhD</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Nationality</label>
                      <input className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.nationality} onChange={e => setFormData({ ...formData, nationality: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 flex items-center gap-1"><Heart size={10} className="text-rose-500" /> Primary Guardian</label>
                      <input placeholder="Name of parent or guardian" className="w-full bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none font-bold text-gray-800" value={formData.guardian} onChange={e => setFormData({ ...formData, guardian: e.target.value })} />
                    </div>
                  </div>
                </section>

                <div className="pt-2 flex justify-center">
                  <button type="submit" className="px-8 py-3 bg-brand text-white rounded text-sm font-semibold shadow-sm shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all" style={{ backgroundColor: brandColor }}>Commit Registry Entry</button>
                </div>
              </form>
            </div>

            <div className="bg-gray-50 p-5 flex flex-col border-l border-gray-100">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <FileText size={16} className="text-brand" /> Compliance Folder
              </h4>
              <div className="mb-5 p-5 bg-white rounded-md border border-gray-200 relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Official Portrait</h5>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-semibold uppercase">2x2</span>
                  </div>
                  {photoPreview ? (
                    <div className="aspect-square w-28 mx-auto rounded border overflow-hidden bg-black shadow-sm">
                      <img src={photoPreview} className="w-full h-full object-cover" alt="Passport" />
                    </div>
                  ) : (
                    <div className="aspect-square w-28 mx-auto rounded border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                      <User size={28} />
                      <span className="text-xs font-semibold uppercase mt-2">No Photo</span>
                    </div>
                  )}
                  <button type="button" onClick={startCamera} className="w-full mt-5 py-2.5 bg-brand text-white rounded text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-brand-hover transition-all" style={{ backgroundColor: brandColor }}>
                    <Camera size={14} /> Open Camera
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {MANDATORY_DOCS.map(doc => {
                  const status = mandatoryDocStatuses[doc];
                  const hasFile = status === 'UPLOADED' || status === 'VERIFIED';
                  return (
                    <div key={doc} className={`p-4 rounded-md border transition-all ${hasFile ? 'bg-white border-brand-light shadow-sm' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {hasFile ? <CheckCircle size={18} className="text-emerald-500 shrink-0" /> : <Clock size={18} className="text-gray-300 shrink-0" />}
                          <span className={`text-xs font-semibold uppercase tracking-tight truncate ${hasFile ? 'text-gray-800' : 'text-gray-400'}`}>{doc}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => fileInputRefs.current[doc]?.click()} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded text-xs font-bold uppercase text-gray-600 hover:border-brand transition-colors">
                        <Upload size={14} /> {hasFile ? 'Replace' : 'Attach'}
                      </button>
                      <input type="file" className="hidden" ref={el => { if (el) fileInputRefs.current[doc] = el; }} onChange={(e) => handleDocumentUpload(doc, e)} accept=".docx,.pdf,.png,.jpeg,.jpg" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Edit Student Page */}
      {showEditModal && editingStudent && (
                  <div className="bg-white rounded-md shadow-sm w-full overflow-hidden animate-in fade-in duration-300 border border-gray-200">
                    <div className="p-5 border-b bg-gradient-to-r from-brand/10 to-brand/20/50 flex flex-col md:flex-row justify-between gap-4 md:items-center">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-brand text-white rounded shadow-sm shadow-brand/20"><RefreshCw size={20} /></div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-800 uppercase tracking-tight">
                            {isProvisionalStudent(editingStudent) ? 'Complete Learner Registration' : 'Edit Student Record'}
                          </h3>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-1">
                            {isProvisionalStudent(editingStudent)
                              ? `Billed by AR as Provisional Learner • Finalize Registration for ${editingStudent.firstName} ${editingStudent.lastName}`
                              : `Update ${editingStudent.firstName} ${editingStudent.lastName}'s Information`}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => { setShowEditModal(false); setEditingStudent(null); setEditPhotoPreview(null); setShowEditCamera(false); }} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors text-xs font-semibold uppercase tracking-wide">
                        <ChevronLeft size={16} /> Back
                      </button>
                    </div>

                    <form onSubmit={(e) => {
                      e.preventDefault();
                      try {
                        const wasProvisional = isProvisionalStudent(editingStudent);
                        const rawDocs = editingStudent.documents || [];
                        const updatedDocuments = wasProvisional
                          ? rawDocs.filter(d => d.id !== 'doc-provisional' && !d.id?.startsWith('doc-provisional') && d.name !== 'Provisional AR Registration')
                          : rawDocs;

                        const updatedStudent: Student = {
                          ...editingStudent,
                          ...formData,
                          id: editingStudent.id,
                          orgId: editingStudent.orgId,
                          registrationStatus: 'REGISTERED',
                          profilePhoto: editPhotoPreview ?? editingStudent.profilePhoto,
                          documents: updatedDocuments,
                          createdAt: editingStudent.createdAt,
                          createdBy: editingStudent.createdBy
                        } as Student;
                        onUpdateStudent(updatedStudent);
                        showToast(
                          wasProvisional
                            ? `Registration completed successfully for ${formData.firstName} ${formData.lastName}!`
                            : `Student ${formData.firstName} ${formData.lastName} updated successfully!`,
                          'success'
                        );
                        setShowEditModal(false);
                        setEditingStudent(null);
                        setEditPhotoPreview(null);
                      } catch (error) {
                        showToast(`Failed to update student: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                      }
                    }} className="p-5 space-y-4 [&_input]:px-3 [&_input]:py-2 [&_select]:px-3 [&_select]:py-2 [&_input]:text-xs [&_select]:text-xs [&_label]:text-[10px] [&_label]:leading-tight">
                      {isProvisionalStudent(editingStudent) && (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-amber-900 text-xs">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-900">Provisional Learner (Billed by AR)</p>
                            <p className="mt-0.5 text-amber-700">
                              This learner record was created in Accounts Receivable during billing before official registration.
                              Fill in the missing registration details (ULI, date of birth, address, educational attainment) and save to finalize full registration.
                            </p>
                          </div>
                        </div>
                      )}
                      <p className="text-[11px] leading-4 text-gray-500">
                        Fields marked <span className="font-semibold text-red-500" aria-hidden="true">*</span> are required.
                      </p>

                      {/* Student Photo */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-20 h-20 rounded-md border-2 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center shadow-sm">
                            {showEditCamera ? (
                              <video ref={editVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            ) : editPhotoPreview ? (
                              <img src={editPhotoPreview} alt="New Photo" className="w-full h-full object-cover" />
                            ) : getStudentProfilePhoto(editingStudent) ? (
                              <img src={getStudentProfilePhoto(editingStudent)} alt="Student" className="w-full h-full object-cover" />
                            ) : (
                              <User size={32} className="text-gray-300" />
                            )}
                          </div>
                          {editPhotoPreview && (
                            <button type="button" onClick={() => setEditPhotoPreview(null)} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Learner Photo</p>
                          <p className="text-xs text-gray-400 font-medium">Capture or upload a replacement profile image.</p>
                        </div>
                        </div>
                        <canvas ref={editCanvasRef} className="hidden" />
                        <input type="file" ref={editPhotoInputRef} accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setEditPhotoPreview(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} />
                        <div className="flex gap-2">
                          {showEditCamera ? (
                            <>
                              <button type="button" onClick={() => {
                                if (editVideoRef.current && editCanvasRef.current) {
                                  const context = editCanvasRef.current.getContext('2d');
                                  if (context) {
                                    editCanvasRef.current.width = editVideoRef.current.videoWidth;
                                    editCanvasRef.current.height = editVideoRef.current.videoHeight;
                                    context.drawImage(editVideoRef.current, 0, 0);
                                    const dataUrl = editCanvasRef.current.toDataURL('image/jpeg', 0.8);
                                    setEditPhotoPreview(dataUrl);
                                    if (editVideoRef.current?.srcObject) {
                                      (editVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                                    }
                                    setShowEditCamera(false);
                                  }
                                }
                              }} className="px-3 py-2 bg-green-600 text-white rounded text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors flex items-center gap-2">
                                <Camera size={14} /> Capture
                              </button>
                              <button type="button" onClick={() => {
                                if (editVideoRef.current?.srcObject) {
                                  (editVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                                }
                                setShowEditCamera(false);
                              }} className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-xs font-bold uppercase tracking-wider hover:bg-gray-300 transition-colors">
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => {
                                setShowEditCamera(true);
                                setTimeout(async () => {
                                  try {
                                    const stream = await navigator.mediaDevices.getUserMedia({
                                      video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }
                                    });
                                    if (editVideoRef.current) editVideoRef.current.srcObject = stream;
                                  } catch (err) {
                                    alert("Camera access denied.");
                                    setShowEditCamera(false);
                                  }
                                }, 100);
                              }} className="px-3 py-2 bg-brand/10 text-brand rounded text-xs font-bold uppercase tracking-wider hover:bg-brand/20 transition-colors flex items-center gap-2">
                                <Camera size={14} /> Camera
                              </button>
                              <button type="button" onClick={() => editPhotoInputRef.current?.click()} className="px-3 py-2 bg-brand/10 text-brand rounded text-xs font-bold uppercase tracking-wider hover:bg-brand/20 transition-colors flex items-center gap-2">
                                <Upload size={14} /> Upload
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Personal Information */}
                      <section className="space-y-3">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500"><User size={14} /></div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">I. Personal Information</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                          <div className="md:col-span-2 space-y-1">
                            <label htmlFor="edit-student-uli" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">
                              ULI <span className="font-medium normal-case tracking-normal">(optional)</span>
                            </label>
                            <input
                              id="edit-student-uli"
                              placeholder="Enter ULI when assigned"
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-semibold text-brand font-mono"
                              value={formData.uli || ''}
                              onChange={e => setFormData({ ...formData, uli: e.target.value })}
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <label htmlFor="edit-student-last-name" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Last Name <span className="text-red-500" aria-hidden="true">*</span></label>
                            <input id="edit-student-last-name" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <label htmlFor="edit-student-first-name" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">First Name <span className="text-red-500" aria-hidden="true">*</span></label>
                            <input id="edit-student-first-name" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Middle Name</label>
                            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.middleName} onChange={e => setFormData({ ...formData, middleName: e.target.value })} />
                          </div>
                          <div className="md:col-span-1 space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Extension</label>
                            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.extension} onChange={e => setFormData({ ...formData, extension: e.target.value })} />
                          </div>
                          <div className="md:col-span-1 space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Sex</label>
                            <select className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.sex} onChange={e => setFormData({ ...formData, sex: e.target.value })}>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <label htmlFor="edit-student-date-of-birth" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Date of Birth <span className="text-red-500" aria-hidden="true">*</span></label>
                            <input id="edit-student-date-of-birth" required type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.dateOfBirth} onChange={handleDobChange} />
                          </div>
                        </div>

                        {/* Birth Address */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Birth Region</label>
                            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.birthRegion || ''} onChange={e => setFormData({ ...formData, birthRegion: e.target.value })} placeholder="e.g. NCR, Region IV-A" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Birth Province</label>
                            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.birthProvince || ''} onChange={e => setFormData({ ...formData, birthProvince: e.target.value })} placeholder="e.g. Metro Manila, Laguna" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Birth City/Municipality</label>
                            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.birthCity || ''} onChange={e => setFormData({ ...formData, birthCity: e.target.value })} placeholder="e.g. Manila, Calamba" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Civil Status</label>
                            <select className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.civilStatus} onChange={e => setFormData({ ...formData, civilStatus: e.target.value })}>
                              <option value="Single">Single</option>
                              <option value="Married">Married</option>
                              <option value="Widowed">Widowed</option>
                              <option value="Divorced">Divorced</option>
                              <option value="Separated">Separated</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Email</label>
                            <input type="email" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Contact Number</label>
                            <input type="tel" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.contactNumber} onChange={e => setFormData({ ...formData, contactNumber: e.target.value })} />
                          </div>
                        </div>
                      </section>

                      {/* Address Information */}
                      <section className="space-y-3">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500"><MapPin size={14} /></div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">II. Address Information</h4>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label htmlFor="edit-student-street" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Street Address <span className="text-red-500" aria-hidden="true">*</span></label>
                            <input id="edit-student-street" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.street} onChange={e => setFormData({ ...formData, street: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label htmlFor="edit-student-barangay" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Barangay <span className="text-red-500" aria-hidden="true">*</span></label>
                              <input id="edit-student-barangay" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.barangay} onChange={e => setFormData({ ...formData, barangay: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                              <label htmlFor="edit-student-city" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">City / Municipality <span className="text-red-500" aria-hidden="true">*</span></label>
                              <input id="edit-student-city" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                              <label htmlFor="edit-student-province" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Province <span className="text-red-500" aria-hidden="true">*</span></label>
                              <input id="edit-student-province" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.province} onChange={e => setFormData({ ...formData, province: e.target.value })} />
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Education & Guardian */}
                      <section className="space-y-3">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500"><BookOpen size={14} /></div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">III. Background & Guardian</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label htmlFor="edit-student-educational-attainment" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Educational Attainment <span className="text-red-500" aria-hidden="true">*</span></label>
                            <select id="edit-student-educational-attainment" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.educationalAttainment} onChange={e => setFormData({ ...formData, educationalAttainment: e.target.value })}>
                              <option value="Elementary Graduate">Elementary Graduate</option>
                              <option value="High School Graduate">High School Graduate</option>
                              <option value="College Level">College Level</option>
                              <option value="College Graduate">College Graduate</option>
                              <option value="TVET Graduate">TVET Graduate</option>
                              <option value="Masteral/PhD">Masteral/PhD</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="edit-student-nationality" className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Nationality <span className="text-red-500" aria-hidden="true">*</span></label>
                            <input id="edit-student-nationality" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.nationality} onChange={e => setFormData({ ...formData, nationality: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 flex items-center gap-1"><Heart size={10} className="text-rose-500" /> Primary Guardian</label>
                            <input placeholder="Name of parent or guardian (optional)" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold text-gray-800" value={formData.guardian || ''} onChange={e => setFormData({ ...formData, guardian: e.target.value })} />
                          </div>
                        </div>
                      </section>

                      <div className="flex justify-center gap-3 pt-3">
                        <button type="button" onClick={() => { setShowEditModal(false); setEditingStudent(null); setEditPhotoPreview(null); setShowEditCamera(false); }} className="px-8 py-3 bg-white border border-gray-200 text-gray-700 rounded text-sm font-semibold uppercase tracking-wide hover:bg-gray-50 transition-all">Cancel</button>
                        <button type="submit" className="px-8 py-3 bg-brand text-white rounded text-sm font-semibold shadow-lg shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all">Save Changes</button>
                      </div>
                    </form>
                  </div>
      )}

      {/* Camera Overlay */}
      {showCamera && (
        <ModalPortal>
        <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-xl flex flex-col items-center justify-center z-[100] p-4">
                  <div className="w-full max-w-md space-y-12">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-white uppercase tracking-tight">Identity Capture</h3>
                      <p className="text-gray-500 text-sm font-medium mt-1">Position learner's face within the frame.</p>
                    </div>
                    <div className="relative aspect-square w-full bg-gray-800 rounded-md overflow-hidden border-4 border-white shadow-md ring-4 ring-brand/10">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-3/4 h-3/4 border-2 border-dashed border-white/40 rounded relative">
                          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-1/2 h-1/2 border-2 border-white/20 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-12">
                      <button onClick={stopCamera} className="w-16 h-16 flex items-center justify-center bg-white/10 text-white rounded-full hover:bg-white/20 transition-all">
                        <X size={28} />
                      </button>
                      <button onClick={capturePhoto} className="w-24 h-24 flex items-center justify-center bg-white text-gray-900 rounded-full hover:scale-110 active:scale-90 transition-all shadow-md ring-8 ring-white/10">
                        <Camera size={40} />
                      </button>
                    </div>
                  </div>
                </div>
        </ModalPortal>
              )}

      {/* Toast Notifications moved to bottom to prevent margin-top issues on header */}
      <div className="fixed top-4 right-4 z-[200] space-y-2 max-w-md">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : toast.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-brand/10 border border-brand-light text-brand'
              }`}
          >
            {toast.type === 'success' && <CheckCircle size={18} className="flex-shrink-0 text-emerald-600" />}
            {toast.type === 'error' && <AlertCircle size={18} className="flex-shrink-0 text-red-600" />}
            {toast.type === 'info' && <AlertCircle size={18} className="flex-shrink-0 text-brand" />}
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

type TesdaFieldKey = keyof Student;

type TesdaOverlayBaseProps = {
  left: number;
  top: number;
  width: number;
  height?: number;
};

const tesdaInputClass = 'absolute rounded-[1px] border border-teal-600/25 bg-white/55 px-1 text-[9px] font-semibold uppercase leading-none text-gray-900 outline-none focus:border-teal-700 focus:bg-white focus:ring-1 focus:ring-teal-600';

const TesdaTextField: React.FC<TesdaOverlayBaseProps & {
  field: TesdaFieldKey;
  formData: Partial<Student>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Student>>>;
  required?: boolean;
  type?: string;
  placeholder?: string;
}> = ({ left, top, width, height = 1.25, field, formData, setFormData, required, type = 'text', placeholder }) => (
  <input
    required={required}
    type={type}
    value={String(formData[field] || '')}
    placeholder={placeholder}
    onChange={event => setFormData(prev => ({ ...prev, [field]: event.target.value }))}
    className={tesdaInputClass}
    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
  />
);

const TesdaSelectField: React.FC<TesdaOverlayBaseProps & {
  field: TesdaFieldKey;
  formData: Partial<Student>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Student>>>;
  options: string[];
}> = ({ left, top, width, height = 1.25, field, formData, setFormData, options }) => (
  <select
    value={String(formData[field] || '')}
    onChange={event => setFormData(prev => ({ ...prev, [field]: event.target.value }))}
    className={`${tesdaInputClass} normal-case`}
    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
  >
    <option value="">Select...</option>
    {options.map(option => <option key={option} value={option}>{option}</option>)}
  </select>
);

const TesdaRadioBox: React.FC<TesdaOverlayBaseProps & {
  field: TesdaFieldKey;
  value: string;
  formData: Partial<Student>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Student>>>;
}> = ({ left, top, width = 1.0, height = 1.0, field, value, formData, setFormData }) => (
  <input
    type="radio"
    checked={String(formData[field] || '').toLowerCase() === value.toLowerCase()}
    onChange={() => setFormData(prev => ({ ...prev, [field]: value }))}
    className="absolute accent-teal-700"
    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
    aria-label={`${String(field)} ${value}`}
  />
);
const DataPoint: React.FC<{ label: string, value: string, isSpan2?: boolean }> = ({ label, value, isSpan2 }) => (
  <div className={isSpan2 ? 'md:col-span-2' : ''}>
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
    <p className="text-sm font-semibold text-gray-800 leading-tight uppercase">{value || 'N/A'}</p>
  </div>
);

export default StudentsView;


