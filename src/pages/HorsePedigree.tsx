import React, { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore, type Horse } from '../store/store';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

const PedigreeNode = ({ horseId, role, generation }: { horseId?: string, role: string, generation: number }) => {
  const horses = useStore(state => state.horses);
  const navigate = useNavigate();
  const horse = horses.find(h => h.id === horseId);

  // Size scaling based on generation
  const sizeClass = generation === 1 ? 'w-48 h-20' : generation === 2 ? 'w-40 h-16' : generation === 3 ? 'w-36 h-14' : 'w-32 h-12';
  const imgClass = generation === 1 ? 'w-16 h-16' : generation === 2 ? 'w-12 h-12' : generation === 3 ? 'w-10 h-10' : 'w-8 h-8';
  const textClass = generation === 1 ? 'text-sm' : generation === 2 ? 'text-xs' : 'text-[10px]';

  if (!horse) {
    return (
      <div className={`${sizeClass} bg-[#121212] border border-slate-800 rounded-xl flex items-center justify-center p-2 opacity-50`}>
        <span className="text-slate-500 text-xs text-center">Unknown<br/>{role}</span>
      </div>
    );
  }

  return (
    <div 
      onClick={() => navigate(`/horses/${horse.id}`)}
      className={`${sizeClass} bg-[#1a1a1a] border ${horse.gender === 'MALE' ? 'border-blue-900/50 hover:border-blue-500' : horse.gender === 'FEMALE' ? 'border-rose-900/50 hover:border-rose-500' : 'border-slate-800 hover:border-emerald-500'} rounded-xl flex items-center p-2 cursor-pointer transition-all shadow-lg hover:shadow-emerald-500/10 group relative`}
    >
      <img src={horse.avatar} alt={horse.name} className={`${imgClass} rounded-lg object-cover shrink-0 mr-3`} />
      <div className="overflow-hidden">
        <p className={`${textClass} font-bold text-white truncate group-hover:text-emerald-400 transition-colors`}>{horse.name}</p>
        <p className="text-[9px] text-slate-500 uppercase tracking-wide truncate">{role}</p>
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

  const getParent = (hid?: string, gender?: 'MALE'|'FEMALE') => {
    if (!hid) return undefined;
    const h = horses.find(x => x.id === hid);
    if (!h) return undefined;
    if (gender === 'MALE') return h.sireId;
    return h.damId;
  };

  if (!targetHorse) return <div className="text-white p-8">Horse not found</div>;

  // Gen 2
  const sire = horses.find(h => h.id === targetHorse.sireId);
  const dam = horses.find(h => h.id === targetHorse.damId);

  // Gen 3
  const sire_sire = horses.find(h => h.id === sire?.sireId);
  const sire_dam = horses.find(h => h.id === sire?.damId);
  const dam_sire = horses.find(h => h.id === dam?.sireId);
  const dam_dam = horses.find(h => h.id === dam?.damId);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1400px] mx-auto pb-20 overflow-hidden">
      <Link to={`/horses/${id}`} className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Back to Profile
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{targetHorse.name}'s Pedigree</h1>
        <p className="text-slate-400">4-Generation Bloodline Lineage</p>
      </div>

      <div className="w-full overflow-x-auto pb-8 custom-scrollbar">
        <div className="min-w-[900px] bg-[#121212] border border-slate-800 rounded-3xl p-8 flex items-center relative">
          
          {/* SVG Connector Lines - Using flex spacing logic conceptually, but hardcoding SVG lines for perfect tree is tough. 
              We'll use CSS Flex/Grid layout with border connectors instead for robust responsive trees. */}
          <div className="flex w-full justify-between items-center relative">
            
            {/* GEN 1 (Target) */}
            <div className="flex-shrink-0 relative z-10 mr-12">
              <PedigreeNode horseId={targetHorse.id} role="Target" generation={1} />
            </div>

            {/* CONNECTORS */}
            <div className="flex-1 flex justify-between relative">
               
               {/* GEN 2 */}
               <div className="flex flex-col justify-around h-[600px] relative z-10 mr-12">
                  <PedigreeNode horseId={targetHorse.sireId} role="Sire" generation={2} />
                  <PedigreeNode horseId={targetHorse.damId} role="Dam" generation={2} />
               </div>

               {/* GEN 3 */}
               <div className="flex flex-col justify-around h-[600px] relative z-10 mr-12">
                  <PedigreeNode horseId={sire?.sireId} role="Grandsire" generation={3} />
                  <PedigreeNode horseId={sire?.damId} role="Granddam" generation={3} />
                  <PedigreeNode horseId={dam?.sireId} role="Grandsire" generation={3} />
                  <PedigreeNode horseId={dam?.damId} role="Granddam" generation={3} />
               </div>

               {/* GEN 4 */}
               <div className="flex flex-col justify-around h-[600px] relative z-10">
                  <PedigreeNode horseId={sire_sire?.sireId} role="G. Grandsire" generation={4} />
                  <PedigreeNode horseId={sire_sire?.damId} role="G. Granddam" generation={4} />
                  <PedigreeNode horseId={sire_dam?.sireId} role="G. Grandsire" generation={4} />
                  <PedigreeNode horseId={sire_dam?.damId} role="G. Granddam" generation={4} />
                  <PedigreeNode horseId={dam_sire?.sireId} role="G. Grandsire" generation={4} />
                  <PedigreeNode horseId={dam_sire?.damId} role="G. Granddam" generation={4} />
                  <PedigreeNode horseId={dam_dam?.sireId} role="G. Grandsire" generation={4} />
                  <PedigreeNode horseId={dam_dam?.damId} role="G. Granddam" generation={4} />
               </div>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};

export default HorsePedigree;