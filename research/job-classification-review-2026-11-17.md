# Employer classification review — 17 November 2026

Reviewed the 30 ATS identities from [the Saudi-board verification snapshot](job-catalogue-verified-2026-11-16.json). This review checks company type and sector; it does not revalidate every vacancy or publication date.

Canonical reviewed metadata: [source/token catalogue](../src/lib/jobs/employer-classifications.json). Each entry records an official evidence URL, review date and paraphrased rationale. Review dates describe when evidence was checked, not when a funding or ownership event occurred. All labels are Watheq editorial mappings from primary company statements, not legal SME classifications or independent verification of company claims.

## Criteria

- `public_sector`: government bodies and wholly state-owned companies. Minority sovereign investment does not qualify. Qiddiya identifies as a PIF company; [PIF ownership evidence](https://annualreport.pif.gov.sa/en/our-investments/our-portfolio/qiddiya/) explicitly records full ownership.
- `enterprise`: a listed company, established multinational corporate business, or corporate subsidiary/joint venture. This label does not assert a specific employee/revenue threshold. JASARA is a corporate joint venture, not classified as a government agency.
- `scaleup`: an established product/platform business with primary evidence of Series B-or-later or pre-IPO financing, an explicit funded scale-up/expansion programme, or documented expansion from founding into multiple international markets. Fundraising proves a disclosed historical event, not current profitability or that the named round is the latest.
- `startup`: the employer explicitly describes itself as a startup and stronger scaleup/corporate evidence was not established in this review. Invygo's [employer-authored job](https://apply.workable.com/invygo/j/DB14A67BB0/) describes a startup environment; the readable [official ATS response](https://apply.workable.com/api/v1/widget/accounts/invygo?details=true) carries that description. Its [company page](https://www.invygo.com/aboutus) separately documents car subscriptions.
- `unclassified`: sector evidence exists but the reviewed primary sources do not establish the above stage/ownership criteria. Usage totals, job counts, customer logos, serving enterprises or marketing claims alone do not establish company size.
- Sectors describe the employer's business, not the candidate's job function. No category is inferred from vacancy volume.

Outcome: **26 categories established; all 30 sectors established** (11 scaleups, 13 enterprises, one startup, one public-sector employer, four category holds).

## Reviewed employers

| Employer | Category | Sector | Official evidence and rationale |
| --- | --- | --- | --- |
| Salla | scaleup | E-commerce software | [Source](https://salla.com/en/ai-info) — Company reports pre-IPO growth funding and an established merchant platform. |
| Mozn | scaleup | Artificial intelligence | [Source](https://www.mozn.ai/humain-mozn-partnership) — Company announces strategic investment supporting international expansion and scale-up of its AI platform. |
| InnovationTeam | unclassified | IT services and consulting | [Source](https://www.innovationteam.com/) — Official services confirm IT and AI consulting; no reliable company-stage or size evidence found. |
| Foodics | scaleup | Restaurant technology | [Source](https://www.foodics.com/foodics-third-financing-round/) — Company confirms Series C funding and restaurant software operations across regional offices. |
| Lucidya | scaleup | Customer experience software | [Source](https://www.lucidya.com/our-company/investors) — Company confirms Series B funding in 2025 and an AI customer-experience product business. |
| invygo | startup | Automotive and mobility | [Source](https://apply.workable.com/invygo/j/DB14A67BB0/) — Employer describes its working environment as a startup and operates car-subscription services. |
| Tamara | scaleup | Financial technology | [Source](https://tamara.co/en-bh/blog-post/tamara-series-c) — Company confirms Series C growth funding for its financial services platform. |
| Scale AI | scaleup | Artificial intelligence | [Source](https://scale.com/blog/scale-ai-series-f) — Company confirms Series F financing and an established AI data product business. |
| Pronto | unclassified | Autonomous vehicle technology | [Source](https://job-boards.greenhouse.io/pronto/jobs/8842898002) — Employer identifies autonomous haulage technology; stage and corporate ownership require further confirmation. |
| KitchenPark | unclassified | Cloud kitchens | [Source](https://job-boards.greenhouse.io/kitchenpark) — Employer describes commercial kitchen facilities; company size and funding stage are not established. |
| BeyondTrust | enterprise | Cybersecurity | [Source](https://www.beyondtrust.com/company/overview) — Established international identity-security company with employees, partners and customers worldwide. |
| Datadog | enterprise | Cloud monitoring and security | [Source](https://investors.datadoghq.com/shareholder-services/investor-faqs) — Company confirms Nasdaq listing; official product links cover monitoring and security. |
| Elastic | enterprise | Search and observability software | [Source](https://ir.elastic.co/overview/default.aspx) — Official investor page identifies NYSE listing and search, observability and security software. |
| Lalamove | scaleup | Logistics technology | [Source](https://www.lalamove.com/en-sg/about-lalamove) — Company describes a technology delivery platform expanded from its 2013 founding into multiple international markets. |
| Lean Technologies | scaleup | Financial technology | [Source](https://leantech.me/uae/en/blog/lean-technologies-secures-67-5m-in-series-b-funding-led-by-general-catalyst-solidifying-its-position-as-the-leading-fintech-infrastructure-platform-in-the-middle-east) — Company confirms Series B growth financing for its financial infrastructure platform. |
| Tabby | scaleup | Financial technology | [Source](https://tabby.ai/en-AE/newsroom/series-e-funding) — Company confirms Series E financing and expansion of its financial services product portfolio. |
| Novartis | enterprise | Healthcare | [Source](https://www.novartis.com/about) — Official company page documents a large multinational medicines business and global employee footprint. |
| Roche | enterprise | Healthcare | [Source](https://www.roche.com/about) — Company documents its long-established global medicines and diagnostics business. |
| KBR | enterprise | Engineering and technology services | [Source](https://www.kbr.com/en/who-we-are) — Established global corporate group delivering government and industrial technology and engineering services. |
| Qiddiya Investment Company | public_sector | Entertainment and development | [Source](https://qiddiya.com/about/) — Company identifies itself as a PIF company developing entertainment, sports and culture; this taxonomy includes wholly state-owned companies. |
| JASARA PMC | enterprise | Project and construction management | [Source](https://jasarapmc.com/who-we-are/) — Official company page confirms a corporate joint venture of Aramco, Jacobs and PIF providing program-management services; not classified as a government agency. |
| Syarah | scaleup | Automotive e-commerce | [Source](https://syarah.com/carsguide/series-c-investment/) — Company announces Series C growth funding for its online car marketplace. |
| webook.com | unclassified | Events and entertainment technology | [Source](https://webook.com/en/about) — Official page confirms an events and ticketing platform with substantial usage; usage alone does not establish funding stage or corporate ownership. |
| Gathern | scaleup | Travel and hospitality technology | [Source](https://blog.gathern.co/en/gathern-closes-sar-270-million-series-b-funding-round-led-by-sanabil-investments-valuing-the-company-at-over-sar-1-billion-in-preparation-for-saudi-stock-market-listing/) — Company confirms Series B growth financing for its alternative-hospitality platform. |
| Tenable | enterprise | Cybersecurity | [Source](https://investors.tenable.com/investor-relations) — Official investor page confirms Nasdaq listing and a global cyber-exposure management business. |
| Recorded Future | enterprise | Cybersecurity | [Source](https://investor.mastercard.com/investor-news/investor-news-details/2024/Mastercard-Finalizes-Acquisition-of-Recorded-Future/) — Mastercard confirms completed acquisition of Recorded Future and its threat-intelligence business. |
| Pure Storage | enterprise | Data storage and management | [Source](https://www.everpuredata.com/company.html) — Original Pure Storage company page redirects to Everpure's official enterprise data-storage business; board display name retained. |
| Philips | enterprise | Healthcare technology | [Source](https://www.philips.com/a-w/about.html) — Official page confirms a long-established global healthcare technology business. |
| Thales | enterprise | Aerospace, defence and digital security | [Source](https://www.thalesgroup.com/en/about-thales) — Official company page documents a large global aerospace, defence and digital-technology group. |
| Sanofi | enterprise | Healthcare | [Source](https://www.sanofi.com/en/our-company) — Company documents a global medicines and vaccines business. |

## Evidence limits and corrections

- Lucidya's prior seed called it a startup. Its current official investor page records a 2025 Series B, so this audit maps it to scaleup.
- Mozn's official strategic-investment page explicitly describes international expansion and global scale-up. No headcount or revenue is inferred.
- Pronto's live Greenhouse job identifies autonomous haulage and also references Atoms; corporate ownership and stage remain unconfirmed. It is not the unrelated similarly named messaging or delivery company.
- InnovationTeam is the IT services company at innovationteam.com, not the Scandinavian engineering company at innovationteam.se. The official product/services page supports the sector only.
- KitchenPark's official board describes commercial kitchen facilities; no funding or size claim is made.
- webook's official page reports platform usage, but does not establish the stage/ownership criteria. Its sector is recorded; its category stays unconfirmed.
- Pure Storage's official company URL redirected to Everpure during review. Preserve the ATS seed display name/identity; the official destination confirms data-storage business. [Official investor page](https://investor.everpuredata.com/stock-information/default.aspx) confirms a NYSE listing.
- Sanofi's [responsible-business page](https://www.sanofi.com/en/our-company/sustainability/responsible-business-values) separately documents operations in more than 100 countries.
- Some official HTML pages render incompletely in text extraction (notably Workable and Elastic investor FAQs); the current employer-authored ATS payload or official investor overview was used instead. No third-party directory supplied a classification.

## Runtime and persistence

`classifyEmployer` in `netlify/lib/job-search.ts` uses the same reviewed catalogue for authenticated search responses while the owner-run SQL is pending. No live fetches, AI calls, extra DB queries or environment variables are added. Exact ATS source/token pairs prevent same-name employer collisions.

A dated database review at or after this audit wins, including a deliberately unclassified value. Known database values without a review date also remain authoritative. Older dated metadata may be superseded by this audit; missing values are filled only when no newer database review blocks them. Separate `category_evidence`/`sector_evidence` objects preserve field origins in mixed responses. Existing `classification_source`/`classification_verified_at` describe the category when known.

The additive [SQL migration](../supabase/migrations/20261117010000_reviewed_employer_classifications.sql) applies the same date/field rules to existing rows. **Prepared only; not applied.** No catalogue membership, job data, user data, subscriptions or crawl state are changed. The original board snapshot and seed remain historical evidence.
