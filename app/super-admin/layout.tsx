import {redirect} from 'next/navigation';
import {requireSuperAdmin} from '@/lib/super-admin';

export default async function SuperAdminLayout({children}:{children:React.ReactNode}){
 const {allowed}=await requireSuperAdmin();
 if(!allowed)redirect('/app');
 return <>{children}</>;
}
