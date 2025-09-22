import { LazyLoadImage } from 'react-lazy-load-image-component';
import Logo from "@/components/ui/Logo";
import AuthBg from "/images/auth-bg.svg";

export default function AuthLayout({
  children,
}) {
  return (
    <>
      <header className="absolute z-30 w-full">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between md:h-20">
            {/* Site branding */}
            <div className="mr-4 shrink-0">
              <Logo />
            </div>
          </div>
        </div>
      </header>

      <main className="relative flex grow h-screen">
        <div
          className="pointer-events-none absolute bottom-0 left-0 -translate-x-1/3"
          aria-hidden="true"
        >
          <div className="h-80 w-80 rounded-full bg-gradient-to-tr from-red-500 opacity-70 blur-[160px]"></div>
        </div>

        {/* Content */}
        <div className="w-full">
          <div className="flex h-full flex-col justify-center before:min-h-[4rem] before:flex-1 after:flex-1 md:before:min-h-[5rem]">
            <div className="px-4 sm:px-6">
              <div className="mx-auto w-full max-w-sm">
                <div className="py-16 md:py-20">{children}</div>
              </div>
            </div>
          </div>
        </div>

        <>
          {/* Right side */}
          <div className="relative my-40 mr-6 hidden w-[572px] shrink-0 overflow-hidden rounded-2xl lg:block">
            {/* Background */}
            <LazyLoadImage
              src="/images/beinto.png"
              className="opacity-90 max-w-none absolute text-center text-black top-[17px] left-1/2 -translate-x-1/2 z-10"
              width={250}
             
              alt="Auth bg"
            />
            
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -ml-24 -translate-x-1/2 -translate-y-1/2 bg-red-50"
              aria-hidden="true"
            >
              <LazyLoadImage
                src={AuthBg}
                className="max-w-none"
                width={1000}
                height={1310}
                alt="Auth bg"
              />
            </div>
            {/* Illustration */}
            <div className="absolute left-32 top-1/2 w-[500px] -translate-y-1/2">
            
              <div className=" w-full rounded-2xl  px-5 py-3 transition duration-300">
            
                <LazyLoadImage
                  src="/images/mockup-mobile.png"
                  className="max-w-none mt-[350px] -translate-x-[310px]"
                  width={900}
                 
                  alt="Mockup home"
                />
                </div>
                </div>
          </div>
        </>
      </main>
    </>
  );
}
