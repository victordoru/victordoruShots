import React from "react";

const Loader = () => {
    return (
        <div className="flex items-center justify-center h-screen">

            <div className="w-12 h-12 rounded-full animate-spin
      border-2 border-solid border-blue-500 border-t-transparent"></div>
        </div>
    );
};

export default Loader;
