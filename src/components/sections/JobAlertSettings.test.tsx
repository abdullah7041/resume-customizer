import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { JobAlertPreferences } from '@/types/jobAlerts';
import { JobAlertSettings } from './JobAlertSettings';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(_key:string,fallback:string)=>fallback,i18n:{language:'en'}})}));
const mocks=vi.hoisted(()=>({read:vi.fn(),update:vi.fn()}));
vi.mock('@/services/jobAlerts',()=>({readJobAlerts:mocks.read,updateJobAlerts:mocks.update}));
const base:JobAlertPreferences={enabled:false,language:'en',scope:'followed',serviceAvailable:true,lastCheckedAt:null,lastOutcome:null,lastProviderAcceptedAt:null};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('VITE_JOB_CATALOGUE_ENABLED','true');mocks.read.mockResolvedValue(base);mocks.update.mockImplementation(async(enabled:boolean,_language:string,scope:string)=>({...base,enabled,scope}));});
it('saves current search criteria before opting in and uses a keyboard accessible control',async()=>{
 const save=vi.fn(async()=>{});
 render(<JobAlertSettings persistIntent={save}/>);
 const toggle=await screen.findByRole('checkbox');
 await waitFor(()=>expect(toggle).not.toBeDisabled());
 fireEvent.click(toggle);
 await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith(true,'en','followed'));
 expect(save).toHaveBeenCalledOnce();
 expect(save.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
});
it('requires an explicit catalogue selection before catalogue consent',async()=>{
 render(<JobAlertSettings persistIntent={vi.fn(async()=>{})}/>);
 const catalogue=await screen.findByRole('radio',{name:'Saudi employer catalogue'});
 await waitFor(()=>expect(catalogue).not.toBeDisabled());fireEvent.click(catalogue);fireEvent.click(screen.getByRole('checkbox'));
 await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith(true,'en','catalogue'));
});
it('shows service pause separately from saved consent',async()=>{
 mocks.read.mockResolvedValue({...base,enabled:true,serviceAvailable:false});render(<JobAlertSettings persistIntent={vi.fn(async()=>{})}/>);
 expect(await screen.findByText('Sending is paused. Your preference is saved; emails will resume when the service is available.')).toBeInTheDocument();
 expect(screen.getByRole('checkbox')).toBeChecked();expect(screen.getByRole('button',{name:'Refresh status'})).toBeInTheDocument();
});
it('shows successful empty checks and labels provider acceptance without claiming receipt',async()=>{
 mocks.read.mockResolvedValue({...base,enabled:true,lastOutcome:'empty',lastCheckedAt:new Date().toISOString(),lastProviderAcceptedAt:new Date().toISOString()});
 render(<JobAlertSettings persistIntent={vi.fn(async()=>{})}/>);
 expect(await screen.findByText('Last check completed: no new qualifying jobs.')).toBeInTheDocument();
 expect(screen.getByText(/Last email accepted by provider/)).toBeInTheDocument();
});
it.each([
 ['failed',new Date().toISOString(),'The last check failed or had incomplete source coverage. Refresh the status later.'],
 ['empty',new Date(Date.now()-3*3600000).toISOString(),'Checks are delayed. Refresh the status later; your preference is saved.'],
])('shows %s operational status with a refresh action',async(lastOutcome,lastCheckedAt,message)=>{
 mocks.read.mockResolvedValue({...base,enabled:true,lastOutcome,lastCheckedAt});render(<JobAlertSettings persistIntent={vi.fn(async()=>{})}/>);
 expect(await screen.findByText(message)).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Refresh status'}));await waitFor(()=>expect(mocks.read).toHaveBeenCalledTimes(2));
});
