'use client';

const BETANO_REF_URL =
  'https://promos.betano.pt/confia-fcporto/index.html?cod=MAISFCP&pid=incomeaccess_int-15985&af_sub1=a_15985b_289c_&af_ad_id=5177&btag=a_15985b_289c_&utm_medium=5177&utm_source=15985&utm_campaign=289&siteid=15985';

type BetanoAdRailsProps = {
  // se quiseres trocar facilmente as imagens no futuro
  desktopImgLeft?: string;
  desktopImgRight?: string;
  mobileImg?: string;
};

export default function BetanoAdRails({
  desktopImgLeft = 'https://cdn.example.com/betano-160x600-left.png',
  desktopImgRight = 'https://cdn.example.com/betano-160x600-right.png',
  mobileImg = 'https://cdn.example.com/betano-300x100-mobile.png',
}: BetanoAdRailsProps) {
  return (
    <>
      {/* Rails laterais – apenas em desktop largo */}
      <a
        href={BETANO_REF_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="
          pointer-events-auto
          fixed
          left-4
          top-32
          hidden
          xl:block
          z-30
        "
      >
        <div className="rounded-2xl bg-black/25 p-1 shadow-xl shadow-black/60 backdrop-blur-sm">
          <img
            src={desktopImgLeft}
            alt="Betano – aposta já"
            className="
              block
              h-auto
              w-[140px]
              rounded-xl
              object-cover
              transition
              duration-300
              ease-out
              hover:-translate-y-1
              hover:scale-[1.03]
              hover:rotate-[-1.5deg]
            "
          />
        </div>
      </a>

      <a
        href={BETANO_REF_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="
          pointer-events-auto
          fixed
          right-4
          top-32
          hidden
          xl:block
          z-30
        "
      >
        <div className="rounded-2xl bg-black/25 p-1 shadow-xl shadow-black/60 backdrop-blur-sm">
          <img
            src={desktopImgRight}
            alt="Betano – aposta já"
            className="
              block
              h-auto
              w-[140px]
              rounded-xl
              object-cover
              transition
              duration-300
              ease-out
              hover:-translate-y-1
              hover:scale-[1.03]
              hover:rotate-[1.5deg]
            "
          />
        </div>
      </a>

      {/* Banner mobile sticky em baixo */}
      <a
        href={BETANO_REF_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="
          pointer-events-auto
          fixed
          inset-x-0
          bottom-0
          z-40
          flex
          justify-center
          lg:hidden
        "
      >
        <div className="w-full max-w-xs px-3 pb-4 pt-1">
          <div className="rounded-t-2xl bg-black/55 p-1 shadow-[0_-12px_45px_rgba(0,0,0,0.9)] backdrop-blur-md">
            <img
              src={mobileImg}
              alt="Betano – aposta já"
              className="
                block
                h-auto
                w-full
                rounded-xl
                object-cover
                transition
                duration-250
                ease-out
                hover:scale-[1.03]
              "
            />
          </div>
        </div>
      </a>
    </>
  );
}
