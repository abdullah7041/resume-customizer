import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { JobAlertSettings } from './JobAlertSettings';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(_key:string,fallback:string)=>fallback,i18n:{language:'en'}})}));
const update=vi.fn(async(..._args:unknown[])=>({enabled:true,language:'en'}));
vi.mock('@/services/jobAlerts',()=>({readJobAlerts:async()=>({enabled:false,language:'en'}),updateJobAlerts:(...args:unknown[])=>update(...args)}));
it('saves current search criteria before opting in and uses a keyboard accessible control',async()=>{
 const save=vi.fn(async()=>{});
 render(<JobAlertSettings persistIntent={save}/>);
 const toggle=await screen.findByRole('checkbox');
 await waitFor(()=>expect(toggle).not.toBeDisabled());
 fireEvent.click(toggle);
 await waitFor(()=>expect(update).toHaveBeenCalledWith(true,'en'));
 expect(save).toHaveBeenCalledOnce();
 expect(save.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
});
