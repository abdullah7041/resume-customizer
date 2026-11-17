-- Owner-run only. Review primary evidence in research/job-classification-review-2026-11-17.md.
-- Additive metadata correction; no inserts, removals, catalogue activation or crawl changes.
-- Preserve newer/equal database reviews and known undated owner metadata.
with reviewed(source,token,category,sector,evidence_url,verified_at) as (values
('workable','salla','scaleup','E-commerce software','https://salla.com/en/ai-info','2026-11-17'),
('workable','mozn-ai','scaleup','Artificial intelligence','https://www.mozn.ai/humain-mozn-partnership','2026-11-17'),
('workable','innovationteam','unclassified','IT services and consulting','https://www.innovationteam.com/','2026-11-17'),
('workable','foodics','scaleup','Restaurant technology','https://www.foodics.com/foodics-third-financing-round/','2026-11-17'),
('workable','lucidya','scaleup','Customer experience software','https://www.lucidya.com/our-company/investors','2026-11-17'),
('workable','invygo','startup','Automotive and mobility','https://apply.workable.com/invygo/j/DB14A67BB0/','2026-11-17'),
('greenhouse','tamara','scaleup','Financial technology','https://tamara.co/en-bh/blog-post/tamara-series-c','2026-11-17'),
('greenhouse','scaleai','scaleup','Artificial intelligence','https://scale.com/blog/scale-ai-series-f','2026-11-17'),
('greenhouse','pronto','unclassified','Autonomous vehicle technology','https://job-boards.greenhouse.io/pronto/jobs/8842898002','2026-11-17'),
('greenhouse','kitchenpark','unclassified','Cloud kitchens','https://job-boards.greenhouse.io/kitchenpark','2026-11-17'),
('greenhouse','beyondtrust','enterprise','Cybersecurity','https://www.beyondtrust.com/company/overview','2026-11-17'),
('greenhouse','datadog','enterprise','Cloud monitoring and security','https://investors.datadoghq.com/shareholder-services/investor-faqs','2026-11-17'),
('greenhouse','elastic','enterprise','Search and observability software','https://ir.elastic.co/overview/default.aspx','2026-11-17'),
('lever','lalamove','scaleup','Logistics technology','https://www.lalamove.com/en-sg/about-lalamove','2026-11-17'),
('ashby','LeanTech','scaleup','Financial technology','https://leantech.me/uae/en/blog/lean-technologies-secures-67-5m-in-series-b-funding-led-by-general-catalyst-solidifying-its-position-as-the-leading-fintech-infrastructure-platform-in-the-middle-east','2026-11-17'),
('pinpoint','tabby','scaleup','Financial technology','https://tabby.ai/en-AE/newsroom/series-e-funding','2026-11-17'),
('workday','novartis:wd3:Novartis_Careers','enterprise','Healthcare','https://www.novartis.com/about','2026-11-17'),
('workday','roche:wd3:roche-ext','enterprise','Healthcare','https://www.roche.com/about','2026-11-17'),
('workday','kbr:wd5:KBR_Careers','enterprise','Engineering and technology services','https://www.kbr.com/en/who-we-are','2026-11-17'),
('workable','qiddiya-investment-company-1','public_sector','Entertainment and development','https://qiddiya.com/about/','2026-11-17'),
('workable','jasarapmc','enterprise','Project and construction management','https://jasarapmc.com/who-we-are/','2026-11-17'),
('workable','syarah','scaleup','Automotive e-commerce','https://syarah.com/carsguide/series-c-investment/','2026-11-17'),
('workable','webook','unclassified','Events and entertainment technology','https://webook.com/en/about','2026-11-17'),
('workable','gathern','scaleup','Travel and hospitality technology','https://blog.gathern.co/en/gathern-closes-sar-270-million-series-b-funding-round-led-by-sanabil-investments-valuing-the-company-at-over-sar-1-billion-in-preparation-for-saudi-stock-market-listing/','2026-11-17'),
('greenhouse','tenableinc','enterprise','Cybersecurity','https://investors.tenable.com/investor-relations','2026-11-17'),
('greenhouse','recordedfuture','enterprise','Cybersecurity','https://investor.mastercard.com/investor-news/investor-news-details/2024/Mastercard-Finalizes-Acquisition-of-Recorded-Future/','2026-11-17'),
('greenhouse','purestorage','enterprise','Data storage and management','https://www.everpuredata.com/company.html','2026-11-17'),
('workday','philips:wd3:jobs-and-careers','enterprise','Healthcare technology','https://www.philips.com/a-w/about.html','2026-11-17'),
('workday','thales:wd3:Careers','enterprise','Aerospace, defence and digital security','https://www.thalesgroup.com/en/about-thales','2026-11-17'),
('workday','sanofi:wd3:SanofiCareers','enterprise','Healthcare','https://www.sanofi.com/en/our-company','2026-11-17')
), changes as (
 select c.id,r.*
 from public.ats_companies c join reviewed r on c.source=r.source and c.token=r.token
 -- The database has one shared source/date: only replace a complete reviewed pair.
 -- Runtime enrichment retains separate field evidence for mixed-origin owner metadata.
 where (c.classification_verified_at<r.verified_at::timestamptz
   or (c.classification_verified_at is null and c.company_category='unclassified' and nullif(trim(c.sector),'') is null))
  and (r.category<>'unclassified' or c.company_category='unclassified')
)
update public.ats_companies c set
 company_category=r.category,
 sector=r.sector,
 classification_source=r.evidence_url,
 classification_verified_at=r.verified_at::timestamptz
from changes r where c.id=r.id;
