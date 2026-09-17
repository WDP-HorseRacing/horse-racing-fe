import { useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import gsap from 'gsap';

const PedigreeNode = ({ horseId, role, generation }: { horseId?: string, role: string, generation: number }) => {
  const horses = useStore(state => state.horses);
  const navigate = useNavigate();
  const horse = horses.find(h => h.id === horseId);

  const sizeClass = generation === 1 ? 'w-52 h-20' : generation === 2 ? 'w-44 h-16' : generation === 3 ? 'w-40 h-14' : 'w-36 h-12';
  const imgClass = generation === 1 ? 'w-14 h-14' : generation === 2 ? 'w-11 h-11' : generation === 3 ? 'w-9 h-9' : 'w-7 h-7';
  const textClass = generation === 1 ? 'text-sm' : generation === 2 ? 'text-xs' : 'text-[10px]';

  if (!horse) {
    return (
      <div className={`${sizeClass} bg-gray-50 border border-gray-200 border-dashed rounded-xl flex items-center justify-center p-2 opacity-60`}>
        <span className="text-gray-400 text-xs text-center leading-tight">Unknown<br/>{role}</span>
      </div>
    );
  }

  const borderColor = horse.gender === 'MALE' ? 'border-blue-200 hover:border-blue-400' :
    horse.gender === 'FEMALE' ? 'border-rose-200 hover:border-rose-400' : 'border-gray-200 hover:border-emerald-400';
  const bgColor = horse.gender === 'MALE' ? 'bg-blue-50/30' :
    horse.gender === 'FEMALE' ? 'bg-rose-50/30' : 'bg-white';

  return (
    <div
      onClick={() => navigate(`/horses/${horse.id}`)}
      className={`${sizeClass} ${bgColor} border ${borderColor} rounded-xl flex items-center p-2.5 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md group relative`}
    >
      <img src={horse.avatar} alt={horse.name} className={`${imgClass} rounded-lg object-cover shrink-0 mr-2.5 border border-gray-100`} />
      <div className="overflow-hidden flex-1 min-w-0">
        <p className={`${textClass} font-semibold text-gray-800 truncate group-hover:text-emerald-600 transition-colors`}>{horse.name}</p>
        <p className="text-[9px] text-gray-400 tracking-wide truncate">{role}</p>
      </div>
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <ExternalLink size={10} className="text-emerald-500" />
      </div>
    </div>
  );
};

const HorsePedigree = () => {
  const { id } = useParams();
  const horses = useStore(state => state.horses);
  const targetHorse = horses.find(h => h.id === id);
  const containerRef = useRef<HTMLDivElement>(null);

  const sire = horses.find(h => h.id === targetHorse?.sireId);
  const dam = horses.find(h => h.id === targetHorse?.damId);
  const sire_sire = horses.find(h => h.id === sire?.sireId);
  const sire_dam = horses.find(h => h.id === sire?.damId);
  const dam_sire = horses.find(h => h.id === dam?.sireId);
  const dam_dam = horses.find(h => h.id === dam?.damId);

  useEffect(() => {
    if (!containerRef.current) return;
    const nodes = containerRef.current.querySelectorAll('[data-pedigree-node]');
    gsap.fromTo(
      nodes,
      { opacity: 0, x: -15 },
      { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', delay: 0.2 }
    );
  }, [id]);

  if (!targetHorse) return <div className="text-center py-20 text-gray-400">Horse not found</div>;

  return (
    <div className="max-w-[1400px] mx-auto pb-12 overflow-hidden">
      <Link to={`/horses/${id}`} className="inline-flex items-center text-gray-400 hover:text-gray-600 mb-6 transition-colors text-sm font-medium">
        <ArrowLeft size={18} className="mr-2" /> Back to profile
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{targetHorse.name}'s pedigree</h1>
        <p className="text-gray-500 font-light">4-generation bloodline lineage</p>
      </div>

      <div className="w-full overflow-x-auto pb-6 custom-scrollbar">
        <div ref={containerRef} className="min-w-[900px] bg-white border border-gray-100 rounded-2xl p-8 flex items-center relative" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex w-full justify-between items-center relative">
            {/* GEN 1 */}
            <div className="flex-shrink-0 relative z-10 mr-12" data-pedigree-node>
              <PedigreeNode horseId={targetHorse.id} role="Target" generation={1} />
            </div>

            <div className="flex-1 flex justify-between relative">
              {/* GEN 2 */}
              <div className="flex flex-col justify-around h-[500px] relative z-10 mr-12">
                <div data-pedigree-node><PedigreeNode horseId={targetHorse.sireId} role="Sire" generation={2} /></div>
                <div data-pedigree-node><PedigreeNode horseId={targetHorse.damId} role="Dam" generation={2} /></div>
              </div>

              {/* GEN 3 */}
              <div className="flex flex-col justify-around h-[500px] relative z-10 mr-12">
                <div data-pedigree-node><PedigreeNode horseId={sire?.sireId} role="Grandsire" generation={3} /></div>
                <div data-pedigree-node><PedigreeNode horseId={sire?.damId} role="Granddam" generation={3} /></div>
                <div data-pedigree-node><PedigreeNode horseId={dam?.sireId} role="Grandsire" generation={3} /></div>
                <div data-pedigree-node><PedigreeNode horseId={dam?.damId} role="Granddam" generation={3} /></div>
              </div>

              {/* GEN 4 */}
              <div className="flex flex-col justify-around h-[500px] relative z-10">
                <div data-pedigree-node><PedigreeNode horseId={sire_sire?.sireId} role="G.Grandsire" generation={4} /></div>
                <div data-pedigree-node><PedigreeNode horseId={sire_sire?.damId} role="G.Granddam" generation={4} /></div>
                <div data-pedigree-node><PedigreeNode horseId={sire_dam?.sireId} role="G.Grandsire" generation={4} /></div>
                <div data-pedigree-node><PedigreeNode horseId={sire_dam?.damId} role="G.Granddam" generation={4} /></div>
                <div data-pedigree-node><PedigreeNode horseId={dam_sire?.sireId} role="G.Grandsire" generation={4} /></div>
                <div data-pedigree-node><PedigreeNode horseId={dam_sire?.damId} role="G.Granddam" generation={4} /></div>
                <div data-pedigree-node><PedigreeNode horseId={dam_dam?.sireId} role="G.Grandsire" generation={4} /></div>
                <div data-pedigree-node><PedigreeNode horseId={dam_dam?.damId} role="G.Granddam" generation={4} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HorsePedigree;