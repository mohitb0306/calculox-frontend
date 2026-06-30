import Link from 'next/link';
import { Metadata } from 'next';
import NotFoundClient from '@/components/common/NotFoundClient';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { getSiteSettings } from '@/lib/content';
import { constructMetadata } from '@/lib/seo';

const { FiHome, FiActivity, FiArrowRight } = FiIcons;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings().catch(() => ({}));
  const baseMetadata = await constructMetadata({
    data: {
      title: "Content Permanently Deleted | 410",
      description: "The page or tool you are looking for has been permanently deleted and is no longer available."
    },
    settings,
    type: 'page' 
  });

  // STRICT SEO: Ensure Google never indexes this custom 410 layout
  return {
    ...baseMetadata,
    robots: {
      index: false,
      follow: false,
      nocache: true,
    }
  };
}

export default async function ContentGone() {
  const settings = await getSiteSettings().catch(() => ({}));

  return (
    <div className="fixed inset-0 z-[100] bg-[#fafafa] flex min-h-screen w-full flex-col items-center justify-center overflow-hidden font-inter text-neutral-900">
      
      {/* Dynamic Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.04),transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
        <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-indigo-200/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-blue-200/20 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <NotFoundClient />

      <div className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center">
        
        {/* Kinetic Hero Section */}
        <div className="relative z-20 mb-6 text-center group">
          <h1 className="text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter select-none
            bg-gradient-to-b from-neutral-900 via-neutral-800 to-transparent bg-clip-text text-transparent
            transition-all duration-700 group-hover:tracking-normal group-hover:from-indigo-600 group-hover:to-transparent">
            410
          </h1>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="px-4 py-1.5 rounded-full bg-white/60 backdrop-blur-md border border-white/40 shadow-sm -mt-10">
                <span className="text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-neutral-800">
                    Permanently Deleted
                </span>
             </div>
          </div>
        </div>

        {/* Messaging Section */}
        <div className="relative z-20 max-w-lg text-center mb-8">
            <h2 className="text-3xl font-bold text-neutral-900 mb-2 tracking-tight">This content is gone.</h2>
            <p className="text-neutral-500 text-lg leading-relaxed">
                The calculation or page you requested has been permanently removed and is no longer available. Let's get you back to the right tools.
            </p>
        </div>

        {/* Action Cards */}
        <div className="relative z-20 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
          <Link href="/" className="group flex items-center p-6 bg-white border border-neutral-200 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-neutral-900 text-white group-hover:bg-indigo-600 transition-colors">
              <SafeIcon icon={FiHome} className="w-6 h-6" />
            </div>
            <div className="ml-4 text-left">
              <p className="font-bold text-neutral-900">Return to Portal</p>
              <p className="text-sm text-neutral-500">Back to the main dashboard.</p>
            </div>
            <SafeIcon icon={FiArrowRight} className="ml-auto w-5 h-5 text-neutral-300 group-hover:text-indigo-600 transition-all group-hover:translate-x-1" />
          </Link>

          <Link href="/calculators" className="group flex items-center p-6 bg-white border border-neutral-200 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-900 border border-neutral-200 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-all">
              <SafeIcon icon={FiActivity} className="w-6 h-6 text-neutral-600 group-hover:text-indigo-600" />
            </div>
            <div className="ml-4 text-left">
              <p className="font-bold text-neutral-900">All Calculators</p>
              <p className="text-sm text-neutral-500">Explore our full suite of tools.</p>
            </div>
            <SafeIcon icon={FiArrowRight} className="ml-auto w-5 h-5 text-neutral-300 group-hover:text-indigo-600 transition-all group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Footer Exception Code */}
        <div className="relative z-20 mt-16 flex items-center gap-3">
            <div className="h-px w-8 bg-neutral-200" />
            <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-neutral-400 uppercase">
                ERROR_CODE: 410_CONTENT_DELETED
            </span>
            <div className="h-px w-8 bg-neutral-200" />
        </div>

      </div>
    </div>
  );
}