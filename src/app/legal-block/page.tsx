import Link from 'next/link';
import { Metadata } from 'next';
import NotFoundClient from '@/components/common/NotFoundClient';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { getSiteSettings } from '@/lib/content';
import { constructMetadata } from '@/lib/seo';

const { FiHome, FiShield, FiArrowRight } = FiIcons;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings().catch(() => ({}));
  const baseMetadata = await constructMetadata({
    data: {
      title: "Unavailable For Legal Reasons | 451",
      description: "Access to this content has been restricted due to legal reasons or regional compliance."
    },
    settings,
    type: 'page' 
  });

  return {
    ...baseMetadata,
    robots: {
      index: false,
      follow: false,
      nocache: true,
    }
  };
}

export default async function LegalBlock() {
  return (
    <div className="fixed inset-0 z-[100] bg-[#fafafa] flex min-h-screen w-full flex-col items-center justify-center overflow-hidden font-inter text-neutral-900">
      
      {/* Dynamic Background Layer - Slightly darker/reddish tint for legal warning */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.03),transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
        <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-red-200/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-orange-200/20 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <NotFoundClient />

      <div className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center">
        
        {/* Kinetic Hero Section */}
        <div className="relative z-20 mb-6 text-center group">
          <h1 className="text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter select-none
            bg-gradient-to-b from-neutral-900 via-neutral-800 to-transparent bg-clip-text text-transparent
            transition-all duration-700 group-hover:tracking-normal group-hover:from-red-600 group-hover:to-transparent">
            451
          </h1>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="px-4 py-1.5 rounded-full bg-white/60 backdrop-blur-md border border-white/40 shadow-sm -mt-10">
                <span className="text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-neutral-800 flex items-center gap-2">
                    <SafeIcon icon={FiShield} className="w-4 h-4 text-red-600" />
                    Access Restricted
                </span>
             </div>
          </div>
        </div>

        {/* Messaging Section */}
        <div className="relative z-20 max-w-lg text-center mb-8">
            <h2 className="text-3xl font-bold text-neutral-900 mb-2 tracking-tight">Content Unavailable.</h2>
            <p className="text-neutral-500 text-lg leading-relaxed">
                We are unable to show you this page. Access to this content has been restricted due to legal demands or regional compliance policies.
            </p>
        </div>

        {/* Action Cards */}
        <div className="relative z-20 grid grid-cols-1 w-full max-w-md mx-auto">
          <Link href="/" className="group flex items-center p-6 bg-white border border-neutral-200 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-neutral-900 text-white group-hover:bg-red-600 transition-colors">
              <SafeIcon icon={FiHome} className="w-6 h-6" />
            </div>
            <div className="ml-4 text-left">
              <p className="font-bold text-neutral-900">Return to Portal</p>
              <p className="text-sm text-neutral-500">Head back to the main dashboard.</p>
            </div>
            <SafeIcon icon={FiArrowRight} className="ml-auto w-5 h-5 text-neutral-300 group-hover:text-red-600 transition-all group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Footer Exception Code */}
        <div className="relative z-20 mt-16 flex items-center gap-3">
            <div className="h-px w-8 bg-neutral-200" />
            <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-neutral-400 uppercase">
                ERROR_CODE: 451_LEGAL_INTERVENTION
            </span>
            <div className="h-px w-8 bg-neutral-200" />
        </div>

      </div>
    </div>
  );
}