export interface Vision2030Sector {
  id: string;
  nameEn: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  skills: Vision2030Skill[];
}

export interface Vision2030Skill {
  nameEn: string;
  nameAr: string;
  keywords: string[];
  keywordsAr: string[];
  weight: number; // 1-3, higher = more important
}

export const VISION_2030_SECTORS: Vision2030Sector[] = [
  {
    id: 'technology',
    nameEn: 'Technology & Digital Transformation',
    nameAr: 'التقنية والتحول الرقمي',
    description: 'Building a digital economy and smart government',
    descriptionAr: 'بناء اقتصاد رقمي وحكومة ذكية',
    icon: '💻',
    skills: [
      {
        nameEn: 'Artificial Intelligence',
        nameAr: 'الذكاء الاصطناعي',
        keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural network', 'nlp', 'computer vision'],
        keywordsAr: ['ذكاء اصطناعي', 'تعلم آلي', 'تعلم عميق', 'شبكات عصبية'],
        weight: 3,
      },
      {
        nameEn: 'Cloud Computing',
        nameAr: 'الحوسبة السحابية',
        keywords: ['cloud', 'aws', 'azure', 'gcp', 'google cloud', 'saas', 'paas', 'iaas', 'kubernetes', 'docker'],
        keywordsAr: ['سحابة', 'حوسبة سحابية', 'أمازون ويب'],
        weight: 3,
      },
      {
        nameEn: 'Cybersecurity',
        nameAr: 'الأمن السيبراني',
        keywords: ['cybersecurity', 'security', 'penetration testing', 'ethical hacking', 'soc', 'siem', 'firewall', 'encryption'],
        keywordsAr: ['أمن سيبراني', 'أمن المعلومات', 'اختبار الاختراق'],
        weight: 3,
      },
      {
        nameEn: 'Data Science & Analytics',
        nameAr: 'علوم البيانات والتحليلات',
        keywords: ['data science', 'data analytics', 'big data', 'hadoop', 'spark', 'tableau', 'power bi', 'sql', 'python', 'r'],
        keywordsAr: ['علوم البيانات', 'تحليل البيانات', 'البيانات الضخمة'],
        weight: 3,
      },
      {
        nameEn: 'Software Development',
        nameAr: 'تطوير البرمجيات',
        keywords: ['software development', 'programming', 'coding', 'javascript', 'python', 'java', 'react', 'node', 'mobile development'],
        keywordsAr: ['تطوير برمجيات', 'برمجة', 'تطبيقات'],
        weight: 2,
      },
      {
        nameEn: 'Blockchain',
        nameAr: 'البلوك تشين',
        keywords: ['blockchain', 'web3', 'smart contracts', 'solidity', 'ethereum', 'crypto'],
        keywordsAr: ['بلوك تشين', 'عقود ذكية', 'العملات الرقمية'],
        weight: 2,
      },
    ],
  },
  {
    id: 'tourism',
    nameEn: 'Tourism & Entertainment',
    nameAr: 'السياحة والترفيه',
    description: 'Developing world-class tourism destinations',
    descriptionAr: 'تطوير وجهات سياحية عالمية المستوى',
    icon: '🏛️',
    skills: [
      {
        nameEn: 'Hospitality Management',
        nameAr: 'إدارة الضيافة',
        keywords: ['hospitality', 'hotel management', 'guest services', 'concierge', 'front desk', 'resort'],
        keywordsAr: ['ضيافة', 'إدارة فنادق', 'خدمات الضيوف'],
        weight: 3,
      },
      {
        nameEn: 'Event Management',
        nameAr: 'إدارة الفعاليات',
        keywords: ['event management', 'event planning', 'conference', 'exhibition', 'festival', 'concert'],
        keywordsAr: ['إدارة فعاليات', 'تنظيم مؤتمرات', 'معارض'],
        weight: 3,
      },
      {
        nameEn: 'Tourism Marketing',
        nameAr: 'التسويق السياحي',
        keywords: ['tourism marketing', 'destination marketing', 'travel agency', 'tour operator'],
        keywordsAr: ['تسويق سياحي', 'وكالة سفر', 'سياحة'],
        weight: 2,
      },
      {
        nameEn: 'Cultural Heritage',
        nameAr: 'التراث الثقافي',
        keywords: ['cultural heritage', 'museum', 'archaeology', 'preservation', 'history', 'unesco'],
        keywordsAr: ['تراث ثقافي', 'متحف', 'آثار', 'تاريخ'],
        weight: 2,
      },
      {
        nameEn: 'Sports & Recreation',
        nameAr: 'الرياضة والترفيه',
        keywords: ['sports management', 'fitness', 'recreation', 'stadium', 'athletics', 'coaching'],
        keywordsAr: ['إدارة رياضية', 'لياقة بدنية', 'ترفيه'],
        weight: 2,
      },
    ],
  },
  {
    id: 'healthcare',
    nameEn: 'Healthcare & Life Sciences',
    nameAr: 'الرعاية الصحية وعلوم الحياة',
    description: 'Building a world-class healthcare system',
    descriptionAr: 'بناء نظام صحي عالمي المستوى',
    icon: '🏥',
    skills: [
      {
        nameEn: 'Healthcare Administration',
        nameAr: 'إدارة الرعاية الصحية',
        keywords: ['healthcare administration', 'hospital management', 'clinic management', 'health informatics'],
        keywordsAr: ['إدارة صحية', 'إدارة مستشفيات', 'معلوماتية صحية'],
        weight: 3,
      },
      {
        nameEn: 'Biotechnology',
        nameAr: 'التقنية الحيوية',
        keywords: ['biotechnology', 'biotech', 'genomics', 'pharmaceutical', 'drug development', 'clinical trials'],
        keywordsAr: ['تقنية حيوية', 'جينوم', 'أدوية'],
        weight: 3,
      },
      {
        nameEn: 'Medical Research',
        nameAr: 'البحث الطبي',
        keywords: ['medical research', 'clinical research', 'epidemiology', 'public health', 'biostatistics'],
        keywordsAr: ['بحث طبي', 'بحث سريري', 'صحة عامة'],
        weight: 3,
      },
      {
        nameEn: 'Digital Health',
        nameAr: 'الصحة الرقمية',
        keywords: ['digital health', 'telemedicine', 'health tech', 'medical devices', 'wearables', 'ehr', 'emr'],
        keywordsAr: ['صحة رقمية', 'طب عن بعد', 'أجهزة طبية'],
        weight: 3,
      },
      {
        nameEn: 'Nursing & Clinical Care',
        nameAr: 'التمريض والرعاية السريرية',
        keywords: ['nursing', 'clinical care', 'patient care', 'icu', 'emergency', 'surgery'],
        keywordsAr: ['تمريض', 'رعاية مرضى', 'عناية مركزة'],
        weight: 2,
      },
    ],
  },
  {
    id: 'renewable-energy',
    nameEn: 'Renewable Energy & Sustainability',
    nameAr: 'الطاقة المتجددة والاستدامة',
    description: 'Leading the global energy transition',
    descriptionAr: 'قيادة التحول العالمي في مجال الطاقة',
    icon: '⚡',
    skills: [
      {
        nameEn: 'Solar Energy',
        nameAr: 'الطاقة الشمسية',
        keywords: ['solar', 'photovoltaic', 'pv', 'solar panel', 'solar farm', 'renewable'],
        keywordsAr: ['طاقة شمسية', 'ألواح شمسية', 'طاقة متجددة'],
        weight: 3,
      },
      {
        nameEn: 'Wind Energy',
        nameAr: 'طاقة الرياح',
        keywords: ['wind energy', 'wind turbine', 'wind farm', 'offshore wind'],
        keywordsAr: ['طاقة الرياح', 'توربينات'],
        weight: 3,
      },
      {
        nameEn: 'Hydrogen & Green Fuels',
        nameAr: 'الهيدروجين والوقود الأخضر',
        keywords: ['hydrogen', 'green hydrogen', 'fuel cell', 'ammonia', 'neom', 'green fuel'],
        keywordsAr: ['هيدروجين', 'هيدروجين أخضر', 'وقود أخضر'],
        weight: 3,
      },
      {
        nameEn: 'Sustainability & ESG',
        nameAr: 'الاستدامة والحوكمة البيئية',
        keywords: ['sustainability', 'esg', 'carbon neutral', 'net zero', 'environmental', 'climate'],
        keywordsAr: ['استدامة', 'حوكمة بيئية', 'صفر كربون'],
        weight: 3,
      },
      {
        nameEn: 'Energy Engineering',
        nameAr: 'هندسة الطاقة',
        keywords: ['energy engineering', 'power systems', 'grid', 'electrical engineering', 'energy storage', 'battery'],
        keywordsAr: ['هندسة طاقة', 'شبكات كهربائية', 'تخزين طاقة'],
        weight: 2,
      },
    ],
  },
  {
    id: 'finance',
    nameEn: 'Financial Services & Fintech',
    nameAr: 'الخدمات المالية والتقنية المالية',
    description: 'Developing a thriving financial sector',
    descriptionAr: 'تطوير قطاع مالي مزدهر',
    icon: '💰',
    skills: [
      {
        nameEn: 'Fintech',
        nameAr: 'التقنية المالية',
        keywords: ['fintech', 'digital payments', 'mobile banking', 'neobank', 'payment gateway', 'stc pay', 'mada'],
        keywordsAr: ['تقنية مالية', 'مدفوعات رقمية', 'بنوك رقمية'],
        weight: 3,
      },
      {
        nameEn: 'Islamic Finance',
        nameAr: 'التمويل الإسلامي',
        keywords: ['islamic finance', 'shariah compliant', 'sukuk', 'takaful', 'murabaha', 'islamic banking'],
        keywordsAr: ['تمويل إسلامي', 'متوافق مع الشريعة', 'صكوك', 'تكافل'],
        weight: 3,
      },
      {
        nameEn: 'Investment Management',
        nameAr: 'إدارة الاستثمار',
        keywords: ['investment', 'portfolio management', 'asset management', 'wealth management', 'private equity', 'venture capital'],
        keywordsAr: ['استثمار', 'إدارة محافظ', 'إدارة أصول', 'إدارة ثروات'],
        weight: 2,
      },
      {
        nameEn: 'Risk & Compliance',
        nameAr: 'المخاطر والامتثال',
        keywords: ['risk management', 'compliance', 'aml', 'kyc', 'regulatory', 'audit', 'sama'],
        keywordsAr: ['إدارة مخاطر', 'امتثال', 'مكافحة غسيل الأموال'],
        weight: 2,
      },
    ],
  },
  {
    id: 'manufacturing',
    nameEn: 'Manufacturing & Industry 4.0',
    nameAr: 'التصنيع والثورة الصناعية الرابعة',
    description: 'Building a competitive industrial base',
    descriptionAr: 'بناء قاعدة صناعية تنافسية',
    icon: '🏭',
    skills: [
      {
        nameEn: 'Industrial Automation',
        nameAr: 'الأتمتة الصناعية',
        keywords: ['automation', 'robotics', 'plc', 'scada', 'industrial robot', 'manufacturing automation'],
        keywordsAr: ['أتمتة', 'روبوتات', 'أتمتة صناعية'],
        weight: 3,
      },
      {
        nameEn: 'Supply Chain Management',
        nameAr: 'إدارة سلسلة الإمداد',
        keywords: ['supply chain', 'logistics', 'procurement', 'inventory', 'warehouse', 'distribution'],
        keywordsAr: ['سلسلة إمداد', 'لوجستيات', 'مشتريات', 'مخازن'],
        weight: 3,
      },
      {
        nameEn: 'Quality Management',
        nameAr: 'إدارة الجودة',
        keywords: ['quality management', 'iso', 'six sigma', 'lean', 'quality assurance', 'quality control'],
        keywordsAr: ['إدارة جودة', 'ضمان جودة', 'آيزو'],
        weight: 2,
      },
      {
        nameEn: 'Advanced Manufacturing',
        nameAr: 'التصنيع المتقدم',
        keywords: ['3d printing', 'additive manufacturing', 'cnc', 'cad', 'cam', 'composite materials'],
        keywordsAr: ['طباعة ثلاثية الأبعاد', 'تصنيع إضافي', 'مواد مركبة'],
        weight: 2,
      },
    ],
  },
  {
    id: 'education',
    nameEn: 'Education & Human Capital',
    nameAr: 'التعليم ورأس المال البشري',
    description: 'Developing future-ready talent',
    descriptionAr: 'تطوير المواهب المستعدة للمستقبل',
    icon: '🎓',
    skills: [
      {
        nameEn: 'Educational Technology',
        nameAr: 'تقنيات التعليم',
        keywords: ['edtech', 'e-learning', 'lms', 'online education', 'educational technology', 'mooc'],
        keywordsAr: ['تقنيات تعليم', 'تعلم إلكتروني', 'تعليم عن بعد'],
        weight: 3,
      },
      {
        nameEn: 'Curriculum Development',
        nameAr: 'تطوير المناهج',
        keywords: ['curriculum', 'instructional design', 'course development', 'pedagogy', 'assessment'],
        keywordsAr: ['مناهج', 'تصميم تعليمي', 'تطوير مقررات'],
        weight: 2,
      },
      {
        nameEn: 'STEM Education',
        nameAr: 'تعليم العلوم والتقنية',
        keywords: ['stem', 'science education', 'math education', 'engineering education', 'coding education'],
        keywordsAr: ['ستيم', 'تعليم علوم', 'تعليم برمجة'],
        weight: 3,
      },
      {
        nameEn: 'Corporate Training',
        nameAr: 'التدريب المؤسسي',
        keywords: ['corporate training', 'l&d', 'learning development', 'talent development', 'leadership training'],
        keywordsAr: ['تدريب مؤسسي', 'تطوير مواهب', 'تدريب قيادة'],
        weight: 2,
      },
    ],
  },
  {
    id: 'mega-projects',
    nameEn: 'Mega Projects & Construction',
    nameAr: 'المشاريع الكبرى والبناء',
    description: 'Building iconic destinations like NEOM, The Line, Red Sea Project',
    descriptionAr: 'بناء وجهات أيقونية مثل نيوم، ذا لاين، مشروع البحر الأحمر',
    icon: '🏗️',
    skills: [
      {
        nameEn: 'Project Management',
        nameAr: 'إدارة المشاريع',
        keywords: ['project management', 'pmp', 'prince2', 'agile', 'scrum', 'construction management'],
        keywordsAr: ['إدارة مشاريع', 'إدارة البناء'],
        weight: 3,
      },
      {
        nameEn: 'Architecture & Urban Planning',
        nameAr: 'العمارة والتخطيط العمراني',
        keywords: ['architecture', 'urban planning', 'urban design', 'master planning', 'sustainable design'],
        keywordsAr: ['عمارة', 'تخطيط عمراني', 'تصميم مستدام'],
        weight: 3,
      },
      {
        nameEn: 'Civil Engineering',
        nameAr: 'الهندسة المدنية',
        keywords: ['civil engineering', 'structural engineering', 'geotechnical', 'infrastructure', 'transportation'],
        keywordsAr: ['هندسة مدنية', 'هندسة إنشائية', 'بنية تحتية'],
        weight: 2,
      },
      {
        nameEn: 'BIM & Digital Construction',
        nameAr: 'نمذجة معلومات البناء والبناء الرقمي',
        keywords: ['bim', 'revit', 'digital twin', 'construction tech', 'smart building'],
        keywordsAr: ['بيم', 'نمذجة معلومات البناء', 'مباني ذكية'],
        weight: 3,
      },
    ],
  },
];

// Flat list of all skills for quick lookup
export const ALL_VISION_2030_SKILLS = VISION_2030_SECTORS.flatMap(sector =>
  sector.skills.map(skill => ({
    ...skill,
    sectorId: sector.id,
    sectorNameEn: sector.nameEn,
    sectorNameAr: sector.nameAr,
  }))
);



