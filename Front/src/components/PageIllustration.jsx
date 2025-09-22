export default function PageIllustration({isHome}) {

  
  return (
    <>
      {/* Stripes illustration */}
      <div className="max-w-screen absolute inset-0 pointer-events-none overflow-hidden">
       
      
      
      {/* Circles */}

      <div
        className={`pointer-events-none ${isHome ? "mt-[100vh]" : ""} absolute top-[-150px] left-[-100px] sm:top-[-100px] sm:left-[-200px]`}
        aria-hidden="true"
      > iuebwr f
        <div className="h-[400px] w-[400px] sm:h-[1100px] sm:w-[1100px] rounded-full bg-gradient-to-tr from-[#FF5757] opacity-20 blur-[160px]" />
      </div>
 
      <div
        className={`pointer-events-none ${isHome ? "mt-[100vh]" : ""} absolute left-1/2 top-[50vh] sm:top-[80vh] ml-[120px] sm:ml-[780px] -translate-x-1/2`}
        aria-hidden="true"
      >
        <div className="h-[400px] w-[400px] sm:h-[1100px] sm:w-[1100px] rounded-full bg-gradient-to-tr from-[#FF5757] opacity-20 blur-[160px]" />
      </div>

      <div
        className={`pointer-events-none ${isHome ? "mt-[100vh]" : ""} absolute left-1/2 top-[100vh] sm:top-[180vh] -ml-[50px] sm:-ml-[300px] -translate-x-1/2`}
        aria-hidden="true"
      >
        <div className="h-[400px] w-[400px] sm:h-[1100px] sm:w-[1100px] rounded-full bg-gradient-to-tr from-[#FF5757] opacity-20 blur-[160px]" />
      </div> 

      </div>
    </>
  );
}
