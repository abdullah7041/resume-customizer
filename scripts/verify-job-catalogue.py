"""Read-only board verification; outputs evidence, never changes the database."""
import concurrent.futures, datetime, json, pathlib, re, sys, urllib.request

CANDIDATES = {
 'workable': 'qiddiya-investment-company-1 jasarapmc syarah webook eramtalent master-works-1 flyakeed-1 al-ayn-university bayut-ksa sikka-ae bayut-dubizzle bayutksa squadio tabby-1 alkaffarygroup adi-dubai-1 nice-one bayut-saudi jazeera-paints alnafitha-it arx-recruitment retal almosafer resal rewaa ithnain alghanim-industries six-flags-qiddiya-city numou saudi-payments alrajhi-takaful bcare gathern riyadh-air numu-guidance salla mozn-ai innovationteam foodics lucidya flyakeed master-works eram-talent jaser alfanar qiddiya qiddiya-investment-company red-sea-global jasara-pmc jasara-pmc-1 al-ayuni-investment-and-contracting-company bayut-saudi-arabia dubizzle-group tawuniya niceone mrsool hungerstation sary nana zid unifonic rasan jahez invygo paytabs baraka intelmatix quant-data-analytics data-sadad d360-bank nphies bupa-arabia bayut',
 'greenhouse': 'snyk tenableinc recordedfuture checkmarx rubrik veeam delinea avature appian servicenow sprinklr purestorage nutanix f5 five9 proofpoint fortinet zoom slack asana amplitude netskope zscaler okta crowdstrike cybersecurity saudiaramco uniphore incyte foodics-sa tamara careem hala noon foodics deliveryhero talabat ninja saudia tabby salla lean samaras scaleai pronto cloudkitchens kitchenpark beyondtrust uipath sentinelone datadog cloudflare canonical grafanalabs mongodb elastic confluent gitlab',
 'lever': 'riyadhair thndr nielseniq nielsen ajaxsystems oivan egis cognite lalamove foodics lucidya',
 'ashby': 'LeanTech baraka rewaa sarj intelmatix',
 'pinpoint': 'tabby',
 'workday': 'redhat:wd5:jobs salesforce:wd12:External_Career_Site salesforce:wd1:External_Career_Site accenture:wd103:AccentureCareers dell:wd1:External philips:wd3:jobs-and-careers siemensenergy:wd3:jobs bakerhughes:wd5:BakerHughes honeywell:wd5:Careers thales:wd3:Careers sanofi:wd3:SanofiCareers bp:wd3:bpCareers atkinsrealis:wd3:Careers schneider:wd3:SE nvidia:wd5:NVIDIAExternalCareerSite brambles:wd5:Brambles_Careers leidos:wd5:External_Careers novartis:wd3:Novartis_Careers pwc:wd3:Global_Experienced_Careers parsons:wd5:Search rollsroyce:wd3:professional airbus:wd5:Airbus boeing:wd1:EXTERNAL_CAREERS gsk:wd5:GSKCareers roche:wd3:roche-ext medtronic:wd1:MedtronicCareers iqvia:wd1:IQVIA pfizer:wd1:PfizerCareers gevernova:wd5:GEV_External gehealthcare:wd5:GEHC_External kbr:wd5:KBR_Careers aecom:wd1:AECOM raytheon:wd5:RTX_External_Careers abb:wd3:External_Career_Site hitachi:wd1:hitachi cargill:wd5:External hilton:wd5:Hilton jll:wd1:jllcareers mastercard:wd1:CorporateCareers adidas:wd3:adidas accor:wd3:accor'

}
def verify(pair):
 source, token = pair
 tenant, host, site = token.split(':') if source=='workday' else ('','','')
 url = {'workday':f'https://{tenant}.{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs','workable':f'https://apply.workable.com/api/v1/widget/accounts/{token}?details=true','greenhouse':f'https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=false','lever':f'https://api.lever.co/v0/postings/{token}?mode=json','ashby':f'https://api.ashbyhq.com/posting-api/job-board/{token}','pinpoint':f'https://{token}.pinpointhq.com/postings.json'}[source]
 result={'source':source,'token':token,'evidenceUrl':url,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  body=json.dumps({'limit':20,'offset':0,'searchText':'Saudi Arabia','appliedFacets':{}}).encode() if source=='workday' else None
  with urllib.request.urlopen(urllib.request.Request(url,data=body,headers={'User-Agent':'Watheq catalogue verification','Content-Type':'application/json'}),timeout=15) as response:
   data=json.load(response)
  jobs = data if isinstance(data,list) else data.get({'pinpoint':'data','workday':'jobPostings'}.get(source,'jobs'))
  if not isinstance(jobs,list):
   raise ValueError('Unexpected job board response')
  locations=[json.dumps({key:j.get(key) for key in ('location','locations','city','country','categories','locationsText')},ensure_ascii=False) for j in jobs]
  saudi=[x for x in locations if re.search(r'saudi|riyadh|jeddah|dammam|khobar|السعود|الرياض',x,re.I)]
  result.update(readable=isinstance(jobs,list),jobCount=len(jobs),saudiLocations=list(dict.fromkeys(saudi))[:3],saudiVerified=bool(saudi))
 except Exception as exc: result.update(readable=False,error=type(exc).__name__)
 return result
if __name__=='__main__':
 path=pathlib.Path('research/job-catalogue-verification-2026-11-16.json')
 previous=json.loads(path.read_text(encoding='utf8')) if path.exists() and '--refresh' not in sys.argv else []
 known={(r['source'],r['token']) for r in previous}
 pairs=[(source,t) for source,tokens in CANDIDATES.items() for t in tokens.split() if (source,t) not in known]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: results=previous+list(pool.map(verify,pairs))
 path=pathlib.Path('research/job-catalogue-verification-2026-11-16.json');path.parent.mkdir(exist_ok=True);path.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'checked':len(results),'saudiVerified':sum(r.get('saudiVerified',False) for r in results),'path':str(path)}))
