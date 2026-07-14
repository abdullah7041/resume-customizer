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
        keywords: [
          'data science', 'data analytics', 'data analyst', 'analyst', 'analytics', 'data analysis',
          'big data', 'hadoop', 'spark', 'tableau', 'power bi', 'powerbi', 'dax',
          'data visualization', 'visualization', 'visualizations', 'visualizing',
          'dashboard', 'dashboards', 'kpi reporting', 'etl', 'data cleaning',
          'pandas', 'numpy', 'jupyter', 'statistical analysis', 'predictive analytics',
          'business intelligence', 'forecasting', 'forecast', 'trend analysis',
          'exploratory analysis', 'exploratory data analysis', 'eda',
          'data extraction', 'data transformation', 'data pipeline',
          'metrics', 'kpi', 'sap', 'erp', 'crm', 'reporting dashboard', 'data-driven',
          'machine learning', 'ai', 'artificial intelligence', 'iot', 'digital transformation'
        ],
        keywordsAr: ['علوم البيانات', 'تحليل البيانات', 'البيانات الضخمة', 'محلل بيانات', 'لوحة معلومات', 'مؤشرات الأداء', 'التحول الرقمي'],
        weight: 3,
      },
      {
        nameEn: 'Software Development',
        nameAr: 'تطوير البرمجيات',
        keywords: ['software development', 'software engineer', 'software developer', 'full stack', 'frontend developer', 'backend developer', 'web development', 'mobile development', 'react developer', 'node.js developer'],
        keywordsAr: ['تطوير برمجيات', 'مهندس برمجيات', 'مطور برمجيات'],
        weight: 2,
      },
      {
        nameEn: 'Blockchain',
        nameAr: 'البلوك تشين',
        keywords: ['blockchain', 'web3', 'smart contracts', 'solidity', 'ethereum', 'crypto'],
        keywordsAr: ['بلوك تشين', 'عقود ذكية', 'العملات الرقمية'],
        weight: 2,
      },
      {
        nameEn: 'Business Intelligence & Reporting',
        nameAr: 'ذكاء الأعمال والتقارير',
        keywords: [
          'business intelligence', 'bi', 'reporting', 'report', 'reports',
          'kpi', 'kpis', 'key performance indicator', 'metrics', 'analytics dashboard',
          'executive reporting', 'management reporting', 'performance reporting',
          'data reporting', 'automated reporting', 'real-time reporting',
          'decision support', 'data-driven decision', 'decision making'
        ],
        keywordsAr: ['ذكاء أعمال', 'تقارير', 'مؤشرات أداء', 'لوحة تحكم'],
        weight: 3,
      },
      {
        nameEn: 'Process Automation',
        nameAr: 'أتمتة العمليات',
        keywords: [
          'process automation', 'automate', 'automating', 'automated',
          'workflow automation', 'rpa', 'robotic process automation',
          'efficiency improvement', 'process improvement', 'process optimization',
          'reducing manual', 'manual errors', 'streamline', 'streamlining',
          'operational efficiency', 'productivity improvement'
        ],
        keywordsAr: ['أتمتة', 'أتمتة العمليات', 'تحسين العمليات', 'كفاءة تشغيلية'],
        weight: 3,
      },
      {
        nameEn: 'Advanced Excel & Spreadsheets',
        nameAr: 'إكسل المتقدم وجداول البيانات',
        keywords: [
          'excel', 'advanced excel', 'spreadsheet', 'spreadsheets',
          'power query', 'powerquery', 'pivot table', 'pivot tables',
          'vlookup', 'xlookup', 'macros', 'vba', 'excel formulas',
          'google sheets', 'data modeling'
        ],
        keywordsAr: ['إكسل', 'جداول بيانات', 'إكسل متقدم'],
        weight: 2,
      },
      {
        nameEn: 'SQL & Database Management',
        nameAr: 'SQL وإدارة قواعد البيانات',
        keywords: [
          'sql', 'mysql', 'postgresql', 'postgres', 'oracle', 'sql server',
          'database', 'databases', 'data extraction', 'query', 'queries',
          'stored procedure', 'data warehouse', 'data lake'
        ],
        keywordsAr: ['قواعد بيانات', 'استعلام', 'مستودع بيانات'],
        weight: 2,
      },
      {
        nameEn: 'Python Programming',
        nameAr: 'برمجة بايثون',
        keywords: [
          'python', 'pandas', 'numpy', 'scipy', 'matplotlib', 'seaborn',
          'jupyter', 'jupyter notebook', 'jupyter notebooks', 'scripting',
          'data analysis python', 'python automation'
        ],
        keywordsAr: ['بايثون', 'برمجة بايثون'],
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
        keywords: ['risk management', 'compliance officer', 'aml specialist', 'kyc analyst', 'regulatory compliance', 'internal audit', 'sama regulations', 'financial risk', 'credit risk'],
        keywordsAr: ['إدارة مخاطر', 'مسؤول امتثال', 'مكافحة غسيل الأموال'],
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
        keywords: ['supply chain management', 'supply chain manager', 'logistics manager', 'procurement manager', 'inventory management', 'warehouse management', 'distribution center', 'supply chain analyst'],
        keywordsAr: ['سلسلة إمداد', 'إدارة لوجستيات', 'مدير مشتريات', 'إدارة مخازن'],
        weight: 3,
      },
      {
        nameEn: 'Quality Management',
        nameAr: 'إدارة الجودة',
        keywords: ['quality management system', 'iso 9001', 'iso certified', 'six sigma black belt', 'six sigma green belt', 'lean manufacturing', 'quality manager', 'qa manager', 'quality engineer'],
        keywordsAr: ['إدارة جودة', 'نظام إدارة الجودة', 'آيزو 9001', 'مهندس جودة'],
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
      {
        nameEn: 'Training & Knowledge Transfer',
        nameAr: 'التدريب ونقل المعرفة',
        keywords: [
          'training', 'trainer', 'coaching', 'mentoring', 'mentor',
          'knowledge transfer', 'upskilling', 'reskilling', 'onboarding',
          'workshop', 'workshops', 'facilitator', 'train the trainer',
          'capability building', 'skill development', 'employee development',
          'delivering training', 'conducted training', 'training programs',
          'cross-functional', 'collaboration', 'workforce development', 'capacity building',
          'skills transfer', 'presentation', 'stakeholder management', 'team leadership'
        ],
        keywordsAr: ['تدريب', 'توجيه', 'نقل المعرفة', 'تطوير الموظفين', 'ورش عمل', 'تعاون', 'تطوير القوى العاملة', 'قيادة الفريق'],
        weight: 3,
      },
      {
        nameEn: 'Data-Driven Culture',
        nameAr: 'ثقافة البيانات',
        keywords: [
          'data-driven', 'data driven', 'analytics culture', 'data culture',
          'evidence-based', 'fostering', 'adoption', 'change management',
          'digital adoption', 'transformation'
        ],
        keywordsAr: ['ثقافة البيانات', 'قائم على البيانات', 'تبني التحول'],
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
        keywords: [
          'project management', 'pmp', 'prince2', 'agile', 'scrum', 'construction management',
          'neom', 'red sea', 'qiddiya', 'diriyah', 'pipefitting', 'field reporting',
          'traceability', 'procurement', 'supply chain', 'logistics', 'contract management',
          'quality control', 'compliance', 'infrastructure', 'engineering'
        ],
        keywordsAr: ['إدارة مشاريع', 'إدارة البناء', 'نيوم', 'البحر الأحمر', 'القدية', 'الدرعية', 'مشتريات', 'سلسلة الإمداد'],
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
  {
    id: 'retail-ecommerce',
    nameEn: 'Retail & E-Commerce',
    nameAr: 'التجزئة والتجارة الإلكترونية',
    description: 'Transforming retail and growing e-commerce',
    descriptionAr: 'تحويل قطاع التجزئة ونمو التجارة الإلكترونية',
    icon: '🛒',
    skills: [
      {
        nameEn: 'E-Commerce Management',
        nameAr: 'إدارة التجارة الإلكترونية',
        keywords: [
          'ecommerce', 'e-commerce', 'online store', 'online sales',
          'shopify', 'magento', 'woocommerce', 'amazon seller',
          'digital commerce', 'marketplace', 'omnichannel'
        ],
        keywordsAr: ['تجارة إلكترونية', 'متجر إلكتروني', 'بيع عبر الإنترنت'],
        weight: 3,
      },
      {
        nameEn: 'Inventory & Stock Management',
        nameAr: 'إدارة المخزون',
        keywords: [
          'inventory', 'inventory management', 'stock management',
          'warehouse', 'warehousing', 'stock control', 'stock optimization',
          'inventory optimization', 'inventory tracking', 'inventory tracker',
          'product waste', 'waste reduction', 'expiration', 'shelf life',
          'sku management', 'reorder point'
        ],
        keywordsAr: ['مخزون', 'إدارة المخزون', 'تحكم بالمخزون', 'مستودع'],
        weight: 3,
      },
      {
        nameEn: 'Sales Analytics & Revenue Growth',
        nameAr: 'تحليلات المبيعات ونمو الإيرادات',
        keywords: [
          'sales analytics', 'sales analysis', 'sales dashboard',
          'revenue growth', 'revenue increase', 'sales growth',
          'sales performance', 'sales kpi', 'sales metrics',
          'customer retention', 'conversion rate', 'sales forecast',
          'sales forecasting', 'sales optimization', 'sales specialist',
          'increasing revenue', 'revenue by'
        ],
        keywordsAr: ['تحليل مبيعات', 'نمو الإيرادات', 'أداء المبيعات'],
        weight: 3,
      },
      {
        nameEn: 'Retail Operations',
        nameAr: 'عمليات التجزئة',
        keywords: [
          'retail', 'retail management', 'store management',
          'point of sale', 'pos', 'merchandising', 'visual merchandising',
          'customer experience', 'retail operations'
        ],
        keywordsAr: ['تجزئة', 'إدارة متجر', 'عمليات التجزئة'],
        weight: 2,
      },
      {
        nameEn: 'Digital Marketing & CRM',
        nameAr: 'التسويق الرقمي وإدارة علاقات العملاء',
        keywords: [
          'digital marketing', 'crm', 'customer relationship',
          'marketing automation', 'email marketing', 'social media marketing',
          'seo', 'sem', 'google ads', 'facebook ads', 'hubspot', 'salesforce'
        ],
        keywordsAr: ['تسويق رقمي', 'إدارة علاقات العملاء'],
        weight: 2,
      },
    ],
  },
  {
    id: 'logistics',
    nameEn: 'Logistics & Transportation',
    nameAr: 'الخدمات اللوجستية والنقل',
    description: 'Building regional logistics hub',
    descriptionAr: 'بناء مركز لوجستي إقليمي',
    icon: '🚚',
    skills: [
      {
        nameEn: 'Supply Chain Analytics',
        nameAr: 'تحليلات سلسلة الإمداد',
        keywords: [
          'supply chain analytics', 'logistics analytics',
          'demand forecasting', 'demand planning', 'supply planning',
          'distribution', 'distribution center', 'fulfillment'
        ],
        keywordsAr: ['تحليلات سلسلة الإمداد', 'تخطيط الطلب'],
        weight: 3,
      },
      {
        nameEn: 'Fleet & Transportation Management',
        nameAr: 'إدارة الأسطول والنقل',
        keywords: [
          'fleet management', 'transportation', 'logistics',
          'shipping', 'freight', 'last mile', 'delivery management',
          'route optimization'
        ],
        keywordsAr: ['إدارة أسطول', 'نقل', 'شحن'],
        weight: 2,
      },
      {
        nameEn: 'Procurement & Vendor Management',
        nameAr: 'المشتريات وإدارة الموردين',
        keywords: [
          'procurement', 'purchasing', 'vendor management',
          'supplier management', 'sourcing', 'contract negotiation',
          'cost reduction', 'cost optimization'
        ],
        keywordsAr: ['مشتريات', 'إدارة موردين', 'توريد'],
        weight: 2,
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

/**
 * Career archetypes with their primary skills and adjacent skill recommendations
 * Used to make contextually relevant suggestions
 */
export interface CareerArchetype {
  id: string;
  nameEn: string;
  nameAr: string;
  /** Skills that indicate this career path */
  primarySkills: string[];
  /** Skills that naturally complement this career (in priority order) */
  adjacentSkills: string[];
  /** Sectors most relevant to this career */
  relevantSectors: string[];
}

export const CAREER_ARCHETYPES: CareerArchetype[] = [
  {
    id: 'data-analytics',
    nameEn: 'Data & Analytics Professional',
    nameAr: 'متخصص البيانات والتحليلات',
    primarySkills: [
      'Data Science & Analytics',
      'Business Intelligence & Reporting',
      'Advanced Excel & Spreadsheets',
      'SQL & Database Management',
      'Python Programming',
    ],
    adjacentSkills: [
      'Process Automation',
      'Advanced Excel & Spreadsheets',
      'SQL & Database Management',
      'Python Programming',
      'Business Intelligence & Reporting',
      'Data-Driven Culture',
      'Training & Knowledge Transfer',
      'Sales Analytics & Revenue Growth',
      'Inventory & Stock Management',
      'Supply Chain Analytics',
    ],
    relevantSectors: ['technology', 'retail-ecommerce', 'finance', 'logistics', 'manufacturing'],
  },
  {
    id: 'software-engineering',
    nameEn: 'Software & Technology Professional',
    nameAr: 'متخصص البرمجيات والتقنية',
    primarySkills: [
      'Software Development',
      'Cloud Computing',
      'Artificial Intelligence',
      'Cybersecurity',
      'Blockchain',
    ],
    adjacentSkills: [
      'Cloud Computing',
      'Cybersecurity',
      'Artificial Intelligence',
      'Software Development',
      'Data Science & Analytics',
      'BIM & Digital Construction',
      'Digital Health',
      'Educational Technology',
      'Fintech',
    ],
    relevantSectors: ['technology', 'finance', 'healthcare', 'education'],
  },
  {
    id: 'project-management',
    nameEn: 'Project & Operations Professional',
    nameAr: 'متخصص المشاريع والعمليات',
    primarySkills: [
      'Project Management',
      'Quality Management',
      'Supply Chain Management',
      'Industrial Automation',
    ],
    adjacentSkills: [
      'Quality Management',
      'Supply Chain Management',
      'Process Automation',
      'Project Management',
      'Civil Engineering',
      'Architecture & Urban Planning',
      'BIM & Digital Construction',
      'Procurement & Vendor Management',
    ],
    relevantSectors: ['mega-projects', 'manufacturing', 'logistics', 'renewable-energy'],
  },
  {
    id: 'finance-professional',
    nameEn: 'Finance & Banking Professional',
    nameAr: 'متخصص المالية والمصرفية',
    primarySkills: [
      'Fintech',
      'Islamic Finance',
      'Investment Management',
      'Risk & Compliance',
    ],
    adjacentSkills: [
      'Risk & Compliance',
      'Investment Management',
      'Islamic Finance',
      'Fintech',
      'Data Science & Analytics',
      'Process Automation',
      'Business Intelligence & Reporting',
    ],
    relevantSectors: ['finance', 'technology'],
  },
  {
    id: 'healthcare-professional',
    nameEn: 'Healthcare Professional',
    nameAr: 'متخصص الرعاية الصحية',
    primarySkills: [
      'Healthcare Administration',
      'Biotechnology',
      'Medical Research',
      'Digital Health',
      'Nursing & Clinical Care',
    ],
    adjacentSkills: [
      'Digital Health',
      'Healthcare Administration',
      'Medical Research',
      'Biotechnology',
      'Data Science & Analytics',
      'Project Management',
    ],
    relevantSectors: ['healthcare', 'technology', 'education'],
  },
  {
    id: 'education-training',
    nameEn: 'Education & Training Professional',
    nameAr: 'متخصص التعليم والتدريب',
    primarySkills: [
      'Educational Technology',
      'Curriculum Development',
      'STEM Education',
      'Corporate Training',
      'Training & Knowledge Transfer',
    ],
    adjacentSkills: [
      'Educational Technology',
      'Training & Knowledge Transfer',
      'Corporate Training',
      'Data-Driven Culture',
      'Curriculum Development',
      'STEM Education',
    ],
    relevantSectors: ['education', 'technology'],
  },
  {
    id: 'sales-retail',
    nameEn: 'Sales & Retail Professional',
    nameAr: 'متخصص المبيعات والتجزئة',
    primarySkills: [
      'Sales Analytics & Revenue Growth',
      'Inventory & Stock Management',
      'E-Commerce Management',
      'Retail Operations',
      'Digital Marketing & CRM',
    ],
    adjacentSkills: [
      'Sales Analytics & Revenue Growth',
      'Inventory & Stock Management',
      'E-Commerce Management',
      'Digital Marketing & CRM',
      'Data Science & Analytics',
      'Business Intelligence & Reporting',
      'Process Automation',
      'Supply Chain Analytics',
    ],
    relevantSectors: ['retail-ecommerce', 'logistics', 'technology'],
  },
  {
    id: 'energy-sustainability',
    nameEn: 'Energy & Sustainability Professional',
    nameAr: 'متخصص الطاقة والاستدامة',
    primarySkills: [
      'Solar Energy',
      'Wind Energy',
      'Hydrogen & Green Fuels',
      'Sustainability & ESG',
      'Energy Engineering',
    ],
    adjacentSkills: [
      'Sustainability & ESG',
      'Energy Engineering',
      'Project Management',
      'Data Science & Analytics',
      'Solar Energy',
      'Wind Energy',
      'Hydrogen & Green Fuels',
    ],
    relevantSectors: ['renewable-energy', 'mega-projects', 'manufacturing'],
  },
  {
    id: 'tourism-hospitality',
    nameEn: 'Tourism & Hospitality Professional',
    nameAr: 'متخصص السياحة والضيافة',
    primarySkills: [
      'Hospitality Management',
      'Event Management',
      'Tourism Marketing',
      'Cultural Heritage',
      'Sports & Recreation',
    ],
    adjacentSkills: [
      'Event Management',
      'Hospitality Management',
      'Tourism Marketing',
      'Digital Marketing & CRM',
      'Project Management',
      'Cultural Heritage',
    ],
    relevantSectors: ['tourism', 'retail-ecommerce', 'mega-projects'],
  },
];

/**
 * Detect career archetype from matched skills
 */
export function detectCareerArchetype(matchedSkillNames: string[]): CareerArchetype | null {
  let bestMatch: CareerArchetype | null = null;
  let bestScore = 0;
  const matchedSkillSet = new Set(matchedSkillNames);

  for (const archetype of CAREER_ARCHETYPES) {
    const matchCount = archetype.primarySkills.filter(skill =>
      matchedSkillSet.has(skill)
    ).length;

    // Score = matches / total primary skills (weighted)
    const score = matchCount > 0 ? matchCount + (matchCount / archetype.primarySkills.length) : 0;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = archetype;
    }
  }

  return bestScore >= 0.5 ? bestMatch : null; // Require at least some meaningful match
}




