import React from 'react';
import { CARD_BY_ID, getSuitCardForSet } from '../data/cards';
import { CardDefinition, SuitElement } from '../types/game';
import { CardVisual } from './CardVisual';

interface RulesGuideProps {
  onInspectCard: (card: CardDefinition) => void;
  onStartQuickDuel: () => void;
}

export const RulesGuide: React.FC<RulesGuideProps> = ({ onInspectCard, onStartQuickDuel }) => {
  const airCard = getSuitCardForSet(SuitElement.AIR, 1);
  const apiCard = getSuitCardForSet(SuitElement.API, 1);
  const daunCard = getSuitCardForSet(SuitElement.DAUN, 1);

  const showcaseCombos = [
    {
      base: CARD_BY_ID['bf-34-boboiboy-blaze'],
      evolved: CARD_BY_ID['bf-31-boboiboy-nova'],
      title: 'Evolusi Blaze menuju Nova (Rank S)',
      desc: 'Turunkan BoBoiBoy Blaze lebih dulu di ronde awal. Pada ronde berikutnya, syarat BoBoiBoy Nova terbuka untuk menyapu seluruh tangan lawan sekaligus memberi 40 kerusakan per kartu!',
    },
    {
      base: CARD_BY_ID['bf-32-solar-taufan'],
      evolved: CARD_BY_ID['bf-32-sr-boboiboy-sopan'],
      title: 'Fusion Solar & Taufan menuju SR Sopan',
      desc: 'BoBoiBoy Solar & Taufan langsung mencari SR BoBoiBoy Sopan dari Dek ke tangan sekaligus memenuhi kedua syarat elemennya dalam satu ronde!',
    },
    {
      base: CARD_BY_ID['bf-44-boboiboy-gopal'],
      evolved: CARD_BY_ID['bf-33-boboiboy-blizzard'],
      title: 'Panggilan Instan BoBoiBoy & Gopal',
      desc: 'Efek 02 milik BoBoiBoy & Gopal menukar dirinya di Zona Aktif dengan Kartu Bersyarat apa pun langsung dari Dek dan mengaktifkan efeknya seketika!',
    },
  ];

  return (
    <section className="max-w-[1160px] mx-auto px-4 sm:px-6 py-8 space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
            Panduan Resmi Pertarungan 1 vs 1
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Mekanisme permainan mengikuti aturan Monsta Galaxy Card dengan sistem Dek Unik Sekali Pakai (tidak ada kartu kembar di dalam dek, dan setiap kartu yang sudah turun tidak dapat dipakai lagi).
          </p>
        </div>
        <button
          type="button"
          onClick={onStartQuickDuel}
          className="px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          Langsung Masuk Arena
        </button>
      </div>

      {/* Section 1: Turn Sequence & Zones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6">
          <div className="text-xs font-mono text-amber-400">01. Dek Unik &amp; Sekali Pakai</div>
          <h2 className="mt-2 text-lg font-display font-bold text-white">Tanpa Kartu Kembar</h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Tidak boleh ada kartu yang sama di dalam dek (maksimal 1 salinan per kartu). Setiap kartu yang telah dimainkan akan berpindah ke Zona Menang atau Zona Kalah dan hanya dipakai satu kali.
          </p>
        </div>

        <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6">
          <div className="text-xs font-mono text-amber-400">02. Urutan Prioritas Efek</div>
          <h2 className="mt-2 text-lg font-display font-bold text-white">Efek 01 → Efek 02 → Efek 03</h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Saat kartu dibuka, Efek 01 (pembatal efek lawan seperti Gempa, Halilintar, Ais) aktif paling awal, disusul Efek 02 (buff/ambil kartu/otomatis menang), lalu Efek 03 (gangguan &amp; perisai).
          </p>
        </div>

        <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6">
          <div className="text-xs font-mono text-amber-400">03. Atur Dek &amp; Kartu Suit Baru</div>
          <h2 className="mt-2 text-lg font-display font-bold text-white">Upload Seri Suit Kustom</h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Simpan banyak slot dek (10, 15, 20, atau 30 kartu unik) dan unggah Kartu Suit baru (Air, Api, Daun) buatanmu sendiri untuk dipakai di Arena Duel, Custom, maupun Multiplayer Online!
          </p>
        </div>
      </div>

      {/* Section 2: Efek K.O. & Penentuan Pemenang Ronde */}
      <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="max-w-2xl">
          <div className="text-xs font-mono text-amber-400">04. Knockout (K.O.) di Semua Mode</div>
          <h2 className="mt-1 text-xl font-display font-bold text-white">
            Penentuan K.O., Double K.O. &amp; Final K.O.
          </h2>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
            Setiap akhir ronde atau saat HP Karakter lawan terkuras, efek K.O.! akan meledak di arena untuk menandai petarung yang tumbang ke Zona Kalah dan pemenang ke Zona Menang.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 space-y-1">
            <div className="text-xs font-mono text-amber-300">K.O.!</div>
            <div className="text-sm font-display font-bold text-white">Kemenangan Ronde</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Karakter dengan sisa HP lebih tinggi (atau pemenang efek Otomatis Menang) memicu K.O. dan masuk ke Zona Menang.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 space-y-1">
            <div className="text-xs font-mono text-rose-300">DOUBLE K.O.!</div>
            <div className="text-sm font-display font-bold text-white">Tumbang Bersamaan</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Jika sisa HP kedua Karakter persis sama di akhir bentrokan ronde, keduanya terkena Double K.O. dan berpindah ke Zona Kalah.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 space-y-1">
            <div className="text-xs font-mono text-emerald-300">FINAL K.O.!</div>
            <div className="text-sm font-display font-bold text-white">Penentuan Juara Laga</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Terjadi saat target kemenangan tercapai, batas ronde selesai, atau keputusan akhir Wasit di Multiplayer Online.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Elemental Suit Triangle */}
      <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="max-w-2xl">
          <h2 className="text-xl font-display font-bold text-white">Segitiga Elemen Kartu Suit</h2>
          <p className="mt-1.5 text-sm text-slate-400">
            Tiga Kartu Suit (Air, Api, Daun) tidak pernah habis dan selalu siap di tanganmu. Jika elemen sama (Seri), Adu Suit diulang hingga ada pemenang.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-8 items-center justify-items-center">
          <div className="flex flex-col items-center text-center">
            <CardVisual card={airCard} size="sm" onClick={() => onInspectCard(airCard)} onInspect={onInspectCard} />
            <h3 className="mt-3 font-display font-bold text-base text-sky-300">AIR Mengalahkan API</h3>
            <p className="mt-1 text-xs text-slate-400">Memadamkan elemen Api · Kalah dari Daun</p>
          </div>

          <div className="flex flex-col items-center text-center">
            <CardVisual card={apiCard} size="sm" onClick={() => onInspectCard(apiCard)} onInspect={onInspectCard} />
            <h3 className="mt-3 font-display font-bold text-base text-rose-300">API Mengalahkan DAUN</h3>
            <p className="mt-1 text-xs text-slate-400">Membakar elemen Daun · Kalah dari Air</p>
          </div>

          <div className="flex flex-col items-center text-center">
            <CardVisual card={daunCard} size="sm" onClick={() => onInspectCard(daunCard)} onInspect={onInspectCard} />
            <h3 className="mt-3 font-display font-bold text-base text-emerald-300">DAUN Mengalahkan AIR</h3>
            <p className="mt-1 text-xs text-slate-400">Menyerap elemen Air · Kalah dari Api</p>
          </div>
        </div>
      </div>

      {/* Section 4: Signature Combos */}
      <div>
        <h2 className="text-xl font-display font-bold text-white">
          Strategi Kartu Bersyarat &amp; Kombo Andalan
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Kartu Rank A, S, AR, dan SR memiliki kekuatan luar biasa setelah karakter prasyaratnya pernah diturunkan ke Zona Aktif.
        </p>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {showcaseCombos.map((combo) => (
            <div
              key={combo.title}
              className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-center justify-center gap-4">
                <CardVisual
                  card={combo.base}
                  size="xs"
                  onClick={() => onInspectCard(combo.base)}
                  onInspect={onInspectCard}
                />
                <span className="font-mono text-sm text-amber-400 font-bold">→</span>
                <CardVisual
                  card={combo.evolved}
                  size="xs"
                  conditionalReady
                  onClick={() => onInspectCard(combo.evolved)}
                  onInspect={onInspectCard}
                />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-white">{combo.title}</h3>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">{combo.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
