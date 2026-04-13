/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dumbbell, 
  ClipboardList, 
  ArrowLeft, 
  Plus, 
  Save, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown,
  GripVertical,
  Play, 
  ListPlus, 
  X, 
  Pause, 
  FastForward, 
  RotateCcw, 
  StepForward, 
  ArrowRight, 
  Volume2, 
  VolumeX,
  Book
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { useCosmicAudio } from './hooks/useCosmicAudio';
import { CosmicFlow } from './components/CosmicFlow';
import { AccretionDisk } from './components/AccretionDisk';

type ViewState = 'MainMenu' | 'ExerciseBuilder' | 'WorkoutPlanner' | 'WorkoutMode' | 'Workouts' | 'ExerciseLibrary';

export interface SavedWorkout {
  id: string;
  name: string;
  items: WorkoutItem[];
}

export interface HIITExercise {
  id: string;
  name: string;
  type: 'HIIT';
  warmup: number;
  hard: number;
  easy: number;
  cooldown: number;
  rounds: number;
  hardName?: string;
  easyName?: string;
  metronome?: {
    warmup?: { enabled: boolean; bpm: number };
    hard?: { enabled: boolean; bpm: number };
    easy?: { enabled: boolean; bpm: number };
    cooldown?: { enabled: boolean; bpm: number };
  };
}

export interface SetExercise {
  id: string;
  name: string;
  type: 'Set';
  sets: number;
  reps: number;
  mode: 'manual' | 'time';
  repDuration?: number;
  restBetweenReps?: number;
  restBetweenSets?: number;
}

export interface SupersetExercise {
  id: string;
  name: string;
  type: 'Superset';
  totalSupersets: number;
  exercises: {
    id: string;
    name: string;
    reps: number;
    mode: 'manual' | 'time';
    repDuration?: number;
    restBetweenReps?: number;
  }[];
  mode: 'manual' | 'timed';
  exerciseTransitionTimer?: number;
  supersetTransitionTimer?: number;
}

export type Exercise = HIITExercise | SetExercise | SupersetExercise;

export interface WorkoutItem {
  uniqueId: string;
  name: string;
  type: 'HIIT' | 'Set' | 'Superset' | 'Library';
  exercise?: Exercise;
}


type Phase = 'Warmup' | 'Hard' | 'Easy' | 'Cooldown' | 'Set_Active' | 'Set_Rest' | 'Set_RepRest' | 'Superset_Active' | 'Superset_ExerciseRest' | 'Superset_RoundRest' | null;

const TOOLBAR_BUTTON_CLASS = "bg-transparent border border-white/[0.03] hover:bg-transparent transition-all duration-300";
const CONTAINER_BUTTON_CLASS = "bg-transparent hover:bg-transparent transition-all duration-300";

const getNextPhaseState = (workout: WorkoutItem[], currentIndex: number, currentPhase: Phase, currentRound: number, currentRep: number = 1, currentSubIndex: number = 0): { index: number, phase: Phase, round: number, rep: number, subIndex: number, time: number } | null => {
  let idx = currentIndex;
  let ph = currentPhase;
  let rnd = currentRound;
  let rep = currentRep;
  let subIdx = currentSubIndex;

  while (idx < workout.length) {
    const ex = workout[idx].exercise;
    
    if (!ex || ex.type === 'HIIT') {
      const hiitEx = (ex as HIITExercise) || { id: '', name: workout[idx].name, type: 'HIIT', warmup: 0, hard: 30, easy: 0, cooldown: 0, rounds: 1 };
      
      if (ph === null) {
        ph = 'Warmup';
        rnd = 1;
        rep = 1;
        subIdx = 0;
      } else if (ph === 'Warmup') {
        ph = 'Hard';
      } else if (ph === 'Hard') {
        ph = 'Easy';
      } else if (ph === 'Easy') {
        if (rnd < hiitEx.rounds) {
          ph = 'Hard';
          rnd++;
        } else {
          ph = 'Cooldown';
        }
      } else if (ph === 'Cooldown') {
        idx++;
        ph = null;
        continue;
      }

      let time = 0;
      if (ph === 'Warmup') time = hiitEx.warmup;
      if (ph === 'Hard') time = hiitEx.hard;
      if (ph === 'Easy') time = hiitEx.easy;
      if (ph === 'Cooldown') time = hiitEx.cooldown;

      if (time > 0) {
        return { index: idx, phase: ph, round: rnd, rep: 1, subIndex: 0, time };
      }
    } else if (ex.type === 'Set') {
      const setEx = ex as SetExercise;
      
      if (ph === null) {
        ph = 'Set_Active';
        rep = 1;
        rnd = 1;
        subIdx = 0;
      } else if (ph === 'Set_Active') {
        if (rep < setEx.reps) {
          if (setEx.mode === 'time' && setEx.restBetweenReps && setEx.restBetweenReps > 0) {
            ph = 'Set_RepRest';
          } else {
            rep++;
            ph = 'Set_Active';
          }
        } else {
          if (rnd < setEx.sets) {
            if (setEx.restBetweenSets && setEx.restBetweenSets > 0) {
              ph = 'Set_Rest';
            } else {
              rnd++;
              rep = 1;
              ph = 'Set_Active';
            }
          } else {
            idx++;
            ph = null;
            continue;
          }
        }
      } else if (ph === 'Set_RepRest') {
        rep++;
        ph = 'Set_Active';
      } else if (ph === 'Set_Rest') {
        rnd++;
        rep = 1;
        ph = 'Set_Active';
      }

      let time = 0;
      if (ph === 'Set_Active') {
        time = (setEx.mode === 'time' && setEx.repDuration) ? setEx.repDuration : 0;
      } else if (ph === 'Set_RepRest') {
        time = setEx.restBetweenReps || 0;
      } else if (ph === 'Set_Rest') {
        time = setEx.restBetweenSets || 0;
      }

      return { index: idx, phase: ph, round: rnd, rep: rep, subIndex: 0, time };
    } else if (ex.type === 'Superset') {
      const ssEx = ex as SupersetExercise;
      
      if (ph === null) {
        ph = 'Superset_Active';
        rnd = 1;
        subIdx = 0;
        rep = 1;
      } else if (ph === 'Superset_Active') {
        const currentSubEx = ssEx.exercises[subIdx];
        if (rep < Number(currentSubEx.reps)) {
          if (currentSubEx.mode === 'time' && currentSubEx.restBetweenReps && currentSubEx.restBetweenReps > 0) {
            ph = 'Superset_Active'; // We'll handle internal rep rest differently or just skip for now
            rep++;
          } else {
            rep++;
          }
        } else {
          if (subIdx < ssEx.exercises.length - 1) {
            if (ssEx.mode === 'timed' && ssEx.exerciseTransitionTimer && ssEx.exerciseTransitionTimer > 0) {
              ph = 'Superset_ExerciseRest';
            } else {
              subIdx++;
              rep = 1;
              ph = 'Superset_Active';
            }
          } else {
            if (rnd < ssEx.totalSupersets) {
              if (ssEx.mode === 'timed' && ssEx.supersetTransitionTimer && ssEx.supersetTransitionTimer > 0) {
                ph = 'Superset_RoundRest';
              } else {
                rnd++;
                subIdx = 0;
                rep = 1;
                ph = 'Superset_Active';
              }
            } else {
              idx++;
              ph = null;
              continue;
            }
          }
        }
      } else if (ph === 'Superset_ExerciseRest') {
        subIdx++;
        rep = 1;
        ph = 'Superset_Active';
      } else if (ph === 'Superset_RoundRest') {
        rnd++;
        subIdx = 0;
        rep = 1;
        ph = 'Superset_Active';
      }

      let time = 0;
      if (ph === 'Superset_Active') {
        const currentSubEx = ssEx.exercises[subIdx];
        time = (currentSubEx.mode === 'time' && currentSubEx.repDuration) ? currentSubEx.repDuration : 0;
      } else if (ph === 'Superset_ExerciseRest') {
        time = ssEx.exerciseTransitionTimer || 0;
      } else if (ph === 'Superset_RoundRest') {
        time = ssEx.supersetTransitionTimer || 0;
      }

      return { index: idx, phase: ph, round: rnd, rep: rep, subIndex: subIdx, time };
    }
  }
  return null;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const WorkoutEngine = ({ workout, name, onExit }: { workout: WorkoutItem[], name: string, onExit: () => void }) => {
  if (!workout || workout.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-xl text-aquamarine/60 mb-6">Your workout is empty. Please add exercises.</p>
        <button 
          onClick={onExit} 
          className="bg-cobalt hover:bg-cyan text-white font-bold py-3 px-8 rounded-2xl transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { 
    initAudio, 
    suspendAudio, 
    playCrystalPing, 
    playDigitalPulse, 
    playResonantBeep, 
    playStellarDrone, 
    playNebulaRise, 
    playSupernovaChord,
    playAtmosphericSwell,
    silenceAll,
    playMetronomeClick,
    setMuted
  } = useCosmicAudio();

  const [status, setStatus] = React.useState<'upNext' | 'countdown' | 'active' | 'finished'>('upNext');
  const [countdownText, setCountdownText] = React.useState('Ready');
  
  const [exerciseIndex, setExerciseIndex] = React.useState(0);
  const [subExerciseIndex, setSubExerciseIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>('Warmup');
  const [round, setRound] = React.useState(1);
  const [rep, setRep] = React.useState(1);
  const [timeLeft, setTimeLeft] = React.useState(0);
  const [explosionTrigger, setExplosionTrigger] = React.useState(0);
  const [isDroning, setIsDroning] = React.useState(false);
  const [bloomIntensity, setBloomIntensity] = React.useState(1.0);
  const [flashTrigger, setFlashTrigger] = React.useState(0);
  const [metronomeBeat, setMetronomeBeat] = React.useState(0);
  const [repFlash, setRepFlash] = React.useState<number | null>(null);
  
  const [isPaused, setIsPaused] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalAction, setModalAction] = React.useState<'none' | 'exit' | 'skipExercise' | 'skipPhase' | 'restartPhase'>('none');

  const currentExItem = workout[exerciseIndex];
  const currentEx = currentExItem.exercise;
  const isSet = currentEx?.type === 'Set';
  const isSuperset = currentEx?.type === 'Superset';
  const isHIIT = currentEx?.type === 'HIIT';
  const hiitDetails = (!isSet && !isSuperset ? currentEx : null) as HIITExercise | null;
  const setDetails = (isSet ? currentEx : null) as SetExercise | null;
  const supersetDetails = (isSuperset ? currentEx : null) as SupersetExercise | null;

  const isMetronomeEnabled = React.useMemo(() => {
    const hiitEx = currentEx?.type === 'HIIT' ? currentEx as HIITExercise : null;
    if (!hiitEx || !hiitEx.metronome) return false;
    let config = null;
    if (phase === 'Warmup') config = hiitEx.metronome.warmup;
    if (phase === 'Hard') config = hiitEx.metronome.hard;
    if (phase === 'Easy') config = hiitEx.metronome.easy;
    if (phase === 'Cooldown') config = hiitEx.metronome.cooldown;
    return !!(config && config.enabled && config.bpm);
  }, [currentEx, phase]);

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const lastPeakTime = React.useRef(0);
  const PEAK_THRESHOLD = 0.3; // Sensitivity
  const COOLDOWN = 1500; // 1.5s cooldown between reps

  const advancePhase = React.useCallback(() => {
    const isRepCompletion = (currentEx?.type === 'Set' && phase === 'Set_Active') || (currentEx?.type === 'Superset' && phase === 'Superset_Active');
    
    const performAdvance = () => {
      const next = getNextPhaseState(workout, exerciseIndex, phase, round, rep, subExerciseIndex);
      if (next) {
        if (next.index > exerciseIndex) {
          setExerciseIndex(next.index);
          setSubExerciseIndex(0);
          setStatus('upNext');
          setTimeLeft(0);
          playStellarDrone();
          setIsDroning(true);
          setTimeout(() => setIsDroning(false), 1000);
          playAtmosphericSwell();
        } else {
          if (next.phase !== phase) {
            playStellarDrone();
            setIsDroning(true);
            setTimeout(() => setIsDroning(false), 1000);
            playAtmosphericSwell();
          }
          setPhase(next.phase);
          setRound(next.round);
          setRep(next.rep);
          setSubExerciseIndex(next.subIndex);
          setTimeLeft(next.time);
          
          // Trigger Up Next screen during Superset Round Rest or Exercise Rest
          if (next.phase === 'Superset_RoundRest' || next.phase === 'Superset_ExerciseRest') {
            setStatus('upNext');
          }
        }
      } else {
        setStatus('finished');
        setTimeLeft(0);
        playStellarDrone();
        setIsDroning(true);
        setTimeout(() => setIsDroning(false), 1000);
      }
    };

    if (isRepCompletion) {
      // Guard against multiple rapid completions
      if (repFlash !== null) return;

      setExplosionTrigger(prev => prev + 1);
      
      // Rep feedback: bloom intensity
      setBloomIntensity(3.0);
      setRepFlash(rep);

      // Check if it's the final rep
      let isFinalRep = false;
      if (isSet && setDetails) {
        isFinalRep = rep === setDetails.reps;
      } else if (isSuperset && supersetDetails) {
        isFinalRep = rep === supersetDetails.exercises[subExerciseIndex].reps;
      }

      if (isFinalRep) {
        playSupernovaChord();
      } else {
        playNebulaRise();
      }

      // Delay the actual phase transition
      setTimeout(() => {
        setBloomIntensity(1.0);
        setRepFlash(null);
        performAdvance();
      }, 800);
    } else {
      performAdvance();
    }
  }, [workout, exerciseIndex, phase, round, rep, subExerciseIndex, isSet, setDetails, isSuperset, supersetDetails, playSupernovaChord, playNebulaRise, playStellarDrone, playAtmosphericSwell, repFlash]);

  // Listening functionality removed
  React.useEffect(() => {
    // ...
  }, [status, exerciseIndex, phase, workout, isPaused]);

  React.useEffect(() => {
    // ...
  }, [analyser, status, isPaused, advancePhase]);

  const openModal = (action: 'exit' | 'skipExercise' | 'skipPhase' | 'restartPhase') => {
    setModalAction(action);
    setIsModalOpen(true);
    setIsPaused(true);
    silenceAll();
  };

  React.useEffect(() => {
    if (status !== 'active' || isPaused || isModalOpen || timeLeft <= 5) return;
    
    const hiitEx = currentEx?.type === 'HIIT' ? currentEx as HIITExercise : null;
    if (!hiitEx || !hiitEx.metronome) return;
    
    let config = null;
    if (phase === 'Warmup') config = hiitEx.metronome.warmup;
    if (phase === 'Hard') config = hiitEx.metronome.hard;
    if (phase === 'Easy') config = hiitEx.metronome.easy;
    if (phase === 'Cooldown') config = hiitEx.metronome.cooldown;
    
    if (!config || !config.enabled || !config.bpm) return;
    
    const interval = (60 / config.bpm) * 1000;
    const timer = setInterval(() => {
      playMetronomeClick();
      setMetronomeBeat(prev => prev + 1);
      setTimeout(() => setMetronomeBeat(0), 100);
    }, interval);
    
    return () => clearInterval(timer);
  }, [status, isPaused, isModalOpen, timeLeft, phase, currentEx, playMetronomeClick]);

  React.useEffect(() => {
    setMuted(isMuted);
  }, [isMuted, setMuted]);

  React.useEffect(() => {
    if (isPaused || isModalOpen) {
      suspendAudio();
    } else {
      initAudio();
    }
  }, [isPaused, isModalOpen, suspendAudio, initAudio]);

  React.useEffect(() => {
    if (status === 'countdown') {
      const sequence = ['Ready', 'Set', 'Go!'];
      let step = 0;
      setCountdownText(sequence[step]);
      playCrystalPing();
      
      const interval = setInterval(() => {
        step++;
        if (step < sequence.length) {
          setCountdownText(sequence[step]);
          playCrystalPing();
        } else {
          clearInterval(interval);
          setStatus('active');
          const next = getNextPhaseState(workout, exerciseIndex, null, 1, 1);
          if (next) {
            setExerciseIndex(next.index);
            setPhase(next.phase);
            setRound(next.round);
            setRep(next.rep);
            setTimeLeft(next.time);
          } else {
            setStatus('finished');
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, workout, exerciseIndex, playCrystalPing]);

  React.useEffect(() => {
    if ((status === 'active' || (status === 'upNext' && timeLeft > 0)) && !isPaused && !isModalOpen) {
      // Determine if the current phase should have a ticking timer
      let shouldTick = true;
      if (currentEx?.type === 'Set' && phase === 'Set_Active') {
        if (setDetails?.mode !== 'time' || !setDetails?.repDuration || setDetails?.repDuration <= 0) {
          shouldTick = false;
        }
      } else if (currentEx?.type === 'Superset' && phase === 'Superset_Active') {
        const subEx = supersetDetails?.exercises[subExerciseIndex];
        if (subEx?.mode !== 'time' || !subEx?.repDuration || subEx?.repDuration <= 0) {
          shouldTick = false;
        }
      }
      
      if (!shouldTick && status === 'active') {
        return; 
      }

      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            advancePhase();
            return 0;
          }
          
          const nextTime = prev - 1;
          if (nextTime <= 5 && nextTime > 0) {
            playResonantBeep();
            setExplosionTrigger(t => t + 1);
            setFlashTrigger(t => t + 1);
            setTimeout(() => setFlashTrigger(0), 150);
          } else if (!isMetronomeEnabled) {
            playDigitalPulse();
          }
          
          return nextTime;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, isPaused, isModalOpen, exerciseIndex, phase, round, rep, subExerciseIndex, workout, advancePhase, timeLeft, setDetails, supersetDetails, currentEx, playResonantBeep, playDigitalPulse, isMetronomeEnabled]);

  const supersetColors = React.useMemo(() => {
    const currentEx = workout[exerciseIndex].exercise;
    if (currentEx?.type === 'Superset') {
      const seed = currentEx.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return currentEx.exercises.map((_, i) => `hsl(${(seed + i * 137.5) % 360}, 80%, 60%)`);
    }
    return [];
  }, [exerciseIndex, workout]);

  const currentSupersetColor = isSuperset ? supersetColors[subExerciseIndex] : undefined;

  const handleModalConfirm = () => {
    playCrystalPing();
    switch (modalAction) {
      case 'exit':
        onExit();
        break;
      case 'skipExercise':
        const nextEx = getNextPhaseState(workout, exerciseIndex + 1, null, 1, 1);
        if (nextEx) {
          setExerciseIndex(nextEx.index);
          setStatus('upNext');
          playStellarDrone();
        } else {
          setStatus('finished');
          playStellarDrone();
        }
        break;
      case 'skipPhase':
        if (isSuperset && phase === 'Superset_Active' && supersetDetails) {
          const next = getNextPhaseState(workout, exerciseIndex, phase, round, Number(supersetDetails.exercises[subExerciseIndex].reps), subExerciseIndex);
          if (next) {
            setPhase(next.phase);
            setRound(next.round);
            setRep(next.rep);
            setSubExerciseIndex(next.subIndex);
            setTimeLeft(next.time);
            if (next.phase === 'Superset_RoundRest' || next.phase === 'Superset_ExerciseRest') {
              setStatus('upNext');
            }
            playStellarDrone();
          }
        } else {
          advancePhase();
        }
        break;
      case 'restartPhase':
        if (!currentEx || currentEx.type === 'HIIT') {
          const ex = (currentEx as HIITExercise) || { id: '', name: '', type: 'HIIT', warmup: 0, hard: 30, easy: 0, cooldown: 0, rounds: 1 };
          let time = 0;
          if (phase === 'Warmup') time = ex.warmup;
          if (phase === 'Hard') time = ex.hard;
          if (phase === 'Easy') time = ex.easy;
          if (phase === 'Cooldown') time = ex.cooldown;
          setTimeLeft(time);
        } else if (currentEx.type === 'Set' && setDetails) {
          let time = 0;
          if (phase === 'Set_Active') {
            time = (setDetails.mode === 'time' && setDetails.repDuration) ? setDetails.repDuration : 0;
          } else if (phase === 'Set_RepRest') {
            time = setDetails.restBetweenReps || 0;
          } else if (phase === 'Set_Rest') {
            time = setDetails.restBetweenSets || 0;
          }
          setTimeLeft(time);
        }
        playStellarDrone();
        break;
    }
    setIsModalOpen(false);
    setModalAction('none');
  };

  if (status === 'upNext') {
    const nextEx = workout[exerciseIndex];
    // Note: nextEx details are already derived at the top of the component as currentEx, isSet, etc.
    // But for clarity in this block, we can use the derived values.

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-absolute-void p-4 relative overflow-hidden">
        <CosmicFlow phase={null} isPaused={false} timeLeft={0} />
        <div className="relative z-20 flex flex-col items-center w-full max-w-md">
          <h2 className="text-2xl md:text-3xl font-black mb-2 bg-gradient-to-r from-cyan to-aquamarine text-transparent bg-clip-text uppercase tracking-widest drop-shadow-[0_0_15px_rgba(0,255,255,0.6)]">
            Up Next:
          </h2>
          
          <div className="w-full text-center mt-4 mb-8 border-white/10 p-4">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
              {nextEx.name}
            </h1>
            <span className="text-sm font-semibold bg-transparent text-aquamarine px-4 py-1 rounded-full inline-block mb-6 border border-cobalt/30">
              {nextEx.exercise?.type || nextEx.type}
            </span>

            {timeLeft > 0 && (
              <div className="mb-6 text-5xl font-mono text-cyan drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]">
                {formatTime(timeLeft)}
              </div>
            )}
            
            {isSet && setDetails ? (
              <>
                <div className="grid grid-cols-3 gap-3 text-center mb-6">
                  <div className="bg-transparent rounded-xl p-2 border border-white/5 shadow-[inset_0_0_20px_rgba(127,255,212,0.05)]">
                    <div className="text-aquamarine/80 text-xs uppercase tracking-wider mb-1 font-bold">Sets</div>
                    <div className="text-2xl font-mono text-white">{setDetails.sets}</div>
                  </div>
                  <div className="bg-transparent rounded-xl p-2 border border-white/5 shadow-[inset_0_0_20px_rgba(0,255,255,0.05)]">
                    <div className="text-cyan/80 text-xs uppercase tracking-wider mb-1 font-bold">Reps</div>
                    <div className="text-2xl font-mono text-white">{setDetails.reps}</div>
                  </div>
                  <div className="bg-transparent rounded-xl p-2 border border-white/5 shadow-[inset_0_0_20px_rgba(0,71,171,0.05)]">
                    <div className="text-teal/80 text-xs uppercase tracking-wider mb-1 font-bold">Mode</div>
                    <div className="text-xl font-mono text-white capitalize">{setDetails.mode}</div>
                  </div>
                </div>
              </>
            ) : isSuperset && supersetDetails ? (
              <div className="w-full space-y-6 mb-8">
                <div className="bg-transparent border border-cobalt/30 rounded-2xl p-4 shadow-[0_0_20px_rgba(0,71,171,0.1)]">
                  <div className="text-aquamarine/80 text-xs uppercase tracking-wider mb-1 font-bold">Superset Roadmap</div>
                  <div className="text-2xl font-mono text-white">Superset: {round} / {supersetDetails.totalSupersets}</div>
                </div>

                <div className="space-y-4 px-2">
                  {supersetDetails.exercises.map((e, i) => {
                    const isNext = i === subExerciseIndex;
                    return (
                      <div 
                        key={e.id} 
                        className={`flex justify-between items-center px-6 py-4 rounded-2xl border transition-all duration-300 ${
                          isNext 
                            ? 'bg-transparent border-cyan scale-120 shadow-[0_0_25px_rgba(0,255,255,0.3)] z-10' 
                            : 'bg-transparent border-white/5 opacity-50'
                        }`}
                      >
                        <span className={`font-bold tracking-tight ${isNext ? 'text-cyan text-xl' : 'text-aquamarine text-sm'}`}>
                          {e.name}
                        </span>
                        <span className={`font-mono ${isNext ? 'text-white text-lg font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-aquamarine/70 text-xs'}`}>
                          — {e.reps} Reps
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-center mb-6">
                  <div className="bg-transparent rounded-xl p-2 border border-white/5 shadow-[inset_0_0_20px_rgba(127,255,212,0.05)]">
                    <div className="text-aquamarine/80 text-xs uppercase tracking-wider mb-1 font-bold">Warmup</div>
                    <div className="text-2xl font-mono text-white">{hiitDetails?.warmup || 0}s</div>
                  </div>
                  <div className="bg-transparent rounded-xl p-2 border border-white/5 shadow-[inset_0_0_20px_rgba(0,255,255,0.05)]">
                    <div className="text-cyan/80 text-xs uppercase tracking-wider mb-1 font-bold">Hard</div>
                    <div className="text-2xl font-mono text-white">{hiitDetails?.hard || 30}s</div>
                  </div>
                  <div className="bg-transparent rounded-xl p-2 border border-white/5 shadow-[inset_0_0_20px_rgba(0,128,128,0.05)]">
                    <div className="text-teal/80 text-xs uppercase tracking-wider mb-1 font-bold">Easy</div>
                    <div className="text-2xl font-mono text-white">{hiitDetails?.easy || 0}s</div>
                  </div>
                  <div className="bg-transparent rounded-xl p-2 border border-white/5 shadow-[inset_0_0_20px_rgba(0,71,171,0.05)]">
                    <div className="text-cobalt/80 text-xs uppercase tracking-wider mb-1 font-bold">Cooldown</div>
                    <div className="text-2xl font-mono text-white">{hiitDetails?.cooldown || 0}s</div>
                  </div>
                </div>
                
                <div className="text-lg text-aquamarine font-mono bg-transparent py-2 rounded-xl border border-cyan/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]">
                  Total Rounds: <span className="font-bold text-white ml-2">{hiitDetails?.rounds || 1}</span>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={() => { playCrystalPing(); setStatus('countdown'); }}
            className="bg-transparent border-2 border-teal hover:border-aquamarine text-teal font-black text-2xl py-4 px-16 rounded-full transition-all shadow-[0_0_30px_rgba(0,128,128,0.3)] hover:shadow-[0_0_50px_rgba(127,255,212,0.6)] hover:scale-105 tracking-widest"
          >
            START
          </button>
        </div>
      </div>
    );
  }

  if (status === 'countdown') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-midnight relative overflow-hidden">
        <CosmicFlow phase={null} isPaused={false} timeLeft={0} />
        <h1 className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan to-aquamarine animate-pulse drop-shadow-[0_0_40px_rgba(0,255,255,0.9)] relative z-20">
          {countdownText}
        </h1>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-midnight p-6 relative overflow-hidden">
        <CosmicFlow phase={null} isPaused={false} timeLeft={0} />
        <div className="relative z-20 flex flex-col items-center">
          <h1 className="text-6xl md:text-8xl font-black text-teal mb-8 drop-shadow-[0_0_30px_rgba(0,128,128,0.7)] text-center">
            WORKOUT COMPLETE
          </h1>
          <button 
            onClick={onExit}
            className="bg-transparent border-2 border-cobalt hover:border-cyan text-aquamarine hover:text-white font-bold py-4 px-12 rounded-full transition-all shadow-[0_0_15px_rgba(0,71,171,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] text-xl"
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }

  const getPhaseColorHex = (p: Phase) => {
    switch (p) {
      case 'Warmup': return '#7FFFD4'; // aquamarine
      case 'Hard': return '#00E5FF'; // cyan
      case 'Easy': return '#00BFA5'; // teal
      case 'Cooldown': return '#0047AB'; // cobalt
      case 'Set_Active': return '#00E5FF'; // cyan
      case 'Set_RepRest': return '#3D5AFE'; // indigo
      case 'Set_Rest': return '#0047AB'; // cobalt
      case 'Superset_Active': return '#00E5FF'; // cyan
      case 'Superset_ExerciseRest': return '#3D5AFE'; // indigo
      case 'Superset_RoundRest': return '#0047AB'; // cobalt
      default: return '#ffffff';
    }
  };

  const getPhaseColorClass = (p: Phase) => {
    switch (p) {
      case 'Warmup': return 'text-aquamarine drop-shadow-[0_0_10px_rgba(127,255,212,0.8)]';
      case 'Hard': return 'text-cyan drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]';
      case 'Easy': return 'text-teal drop-shadow-[0_0_10px_rgba(0,191,165,0.8)]';
      case 'Cooldown': return 'text-cobalt drop-shadow-[0_0_10px_rgba(0,71,171,0.8)]';
      case 'Set_Active': return 'text-cyan drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]';
      case 'Set_RepRest': return 'text-indigo drop-shadow-[0_0_10px_rgba(61,90,254,0.8)]';
      case 'Set_Rest': return 'text-cobalt drop-shadow-[0_0_10px_rgba(0,71,171,0.8)]';
      case 'Superset_Active': return 'text-cyan drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]';
      case 'Superset_ExerciseRest': return 'text-indigo drop-shadow-[0_0_10px_rgba(61,90,254,0.8)]';
      case 'Superset_RoundRest': return 'text-cobalt drop-shadow-[0_0_10px_rgba(0,71,171,0.8)]';
      default: return 'text-white';
    }
  };

  const isWarning = timeLeft <= 5 && timeLeft > 0 && !isPaused;
  
  const getBorderPulseClass = () => {
    if (isDroning) return 'border-white shadow-[inset_0_0_100px_rgba(255,255,255,0.8)]';
    if (flashTrigger > 0) return 'border-white/80 shadow-[inset_0_0_70px_rgba(255,255,255,0.6)]';
    if (!isWarning) return 'border-transparent';
    switch (phase) {
      case 'Warmup': return 'animate-[pulse_1s_ease-in-out_infinite] border-aquamarine shadow-[inset_0_0_50px_rgba(127,255,212,0.5)]';
      case 'Hard': return 'animate-[pulse_1s_ease-in-out_infinite] border-cyan shadow-[inset_0_0_50px_rgba(0,255,255,0.5)]';
      case 'Easy': return 'animate-[pulse_1s_ease-in-out_infinite] border-teal shadow-[inset_0_0_50px_rgba(0,128,128,0.5)]';
      case 'Cooldown': return 'animate-[pulse_1s_ease-in-out_infinite] border-cobalt shadow-[inset_0_0_50px_rgba(0,71,171,0.5)]';
      case 'Set_Active': return 'animate-[pulse_1s_ease-in-out_infinite] border-cyan shadow-[inset_0_0_50px_rgba(0,255,255,0.5)]';
      case 'Set_RepRest': return 'animate-[pulse_1s_ease-in-out_infinite] border-indigo shadow-[inset_0_0_50px_rgba(46,8,84,0.5)]';
      case 'Set_Rest': return 'animate-[pulse_1s_ease-in-out_infinite] border-cobalt shadow-[inset_0_0_50px_rgba(0,71,171,0.5)]';
      case 'Superset_Active': return 'animate-[pulse_1s_ease-in-out_infinite] border-cyan shadow-[inset_0_0_50px_rgba(0,255,255,0.5)]';
      case 'Superset_ExerciseRest': return 'animate-[pulse_1s_ease-in-out_infinite] border-indigo shadow-[inset_0_0_50px_rgba(46,8,84,0.5)]';
      case 'Superset_RoundRest': return 'animate-[pulse_1s_ease-in-out_infinite] border-cobalt shadow-[inset_0_0_50px_rgba(0,71,171,0.5)]';
      default: return 'border-transparent';
    }
  };
  
  const borderPulseClass = getBorderPulseClass();

  const isTimedActive = (isSet && phase === 'Set_Active' && setDetails?.mode === 'time' && setDetails?.repDuration && setDetails?.repDuration > 0) ||
                        (isSuperset && phase === 'Superset_Active' && supersetDetails?.exercises[subExerciseIndex].mode === 'time' && supersetDetails?.exercises[subExerciseIndex].repDuration && supersetDetails?.exercises[subExerciseIndex].repDuration > 0);

  const handleScreenTap = (e: React.MouseEvent) => {
    if (((isSet && phase === 'Set_Active') || (isSuperset && phase === 'Superset_Active')) && !isTimedActive) {
      advancePhase();
    }
  };

  return (
    <div 
      className={`min-h-screen bg-absolute-void flex flex-col p-4 relative overflow-hidden border-8 transition-colors duration-500 ${borderPulseClass}`}
    >
      <CosmicFlow 
        phase={phase} 
        isPaused={isPaused} 
        timeLeft={timeLeft} 
        explosionTrigger={explosionTrigger} 
        customColor={currentSupersetColor} 
        isDroning={isDroning}
        bloomIntensity={bloomIntensity}
        metronomeBeat={metronomeBeat}
        isHIIT={currentEx?.type === 'HIIT'}
        isMetronomeEnabled={isMetronomeEnabled}
      />
      
      {/* Full-screen invisible overlay for manual rep advance */}
      {((isSet && phase === 'Set_Active') || (isSuperset && phase === 'Superset_Active')) && !isTimedActive && (
        <div 
          className="absolute inset-0 z-[15] cursor-pointer"
          onClick={handleScreenTap}
        />
      )}
      
      {/* 1. Top Header */}
      <div className="relative z-20 flex justify-between items-center w-full">
        <button 
          onClick={(e) => { e.stopPropagation(); playCrystalPing(); openModal('exit'); }} 
          className="p-2 text-white/60 hover:text-stellar-ember transition-colors"
        >
          <X className="w-8 h-8" />
        </button>
        
        <button 
          onClick={(e) => { e.stopPropagation(); playCrystalPing(); setIsMuted(!isMuted); }} 
          className="p-2 text-white/60 hover:text-white transition-colors"
        >
          {isMuted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); playCrystalPing(); openModal('skipExercise'); }} 
          className="p-2 text-white/60 hover:text-cyan transition-colors"
        >
          <FastForward className="w-8 h-8" />
        </button>
      </div>

      {/* 2. Text Boxes */}
      <div className="relative z-20 flex flex-col items-center w-full mt-2">
        <div className="border border-black bg-transparent px-2 py-0.5 mb-1">
          <h2 className="text-lg font-bold text-white">
            {isSuperset && supersetDetails ? supersetDetails.exercises[subExerciseIndex].name : currentEx.name}
          </h2>
        </div>
        
        <div className="border border-black bg-transparent px-2 py-0.5 mb-2">
          {isSet && setDetails ? (
            <div className="text-sm text-white font-mono">
              SET {round} / {setDetails.sets} — REP {rep} / {setDetails.reps}
            </div>
          ) : isSuperset && supersetDetails ? (
            <div className="text-sm text-white font-mono">
              ROUND {round} / {supersetDetails.totalSupersets} — REP {rep} / {supersetDetails.exercises[subExerciseIndex].reps}
            </div>
          ) : (
            (phase === 'Hard' || phase === 'Easy' || phase === 'Warmup' || phase === 'Cooldown') && (
              <div className="text-sm text-white font-mono">
                Round {round} / {hiitDetails?.rounds || 1}
              </div>
            )
          )}
        </div>

        <h3 className={`text-3xl font-black uppercase tracking-widest ${getPhaseColorClass(phase)}`}>
          {phase === 'Set_RepRest' ? 'REST' : 
           phase === 'Set_Rest' ? 'SET REST' : 
           phase === 'Hard' ? (hiitDetails?.hardName || 'PHASE 1') :
           phase === 'Easy' ? (hiitDetails?.easyName || 'PHASE 2') :
           phase?.replace('Set_', '')}
        </h3>
      </div>

      {/* Spacer to clear the middle */}
      <div className="flex-1 flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          {repFlash !== null && (
            <motion.div 
              key={`rep-flash-${repFlash}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="text-[15rem] md:text-[20rem] font-black text-white/20 select-none">
                {repFlash}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Timer */}
      <div className="relative z-20 text-center text-7xl font-black leading-none font-mono text-white mb-4">
        {isSet && phase === 'Set_Active' ? (
          isTimedActive ? (
            <span>{formatTime(timeLeft)}</span>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); advancePhase(); }}
              className={`pointer-events-auto bg-transparent border border-white/20 rounded-2xl px-8 py-4 transition-colors ${CONTAINER_BUTTON_CLASS}`}
            >
              <span>{rep} / {setDetails?.reps}</span>
            </button>
          )
        ) : isSuperset && phase === 'Superset_Active' && supersetDetails ? (
          isTimedActive ? (
            <span>{formatTime(timeLeft)}</span>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); advancePhase(); }}
              className={`pointer-events-auto bg-transparent border border-white/20 rounded-2xl px-8 py-4 transition-colors ${CONTAINER_BUTTON_CLASS}`}
            >
              <span>{rep} / {supersetDetails.exercises[subExerciseIndex].reps}</span>
            </button>
          )
        ) : (
          <span>{formatTime(timeLeft)}</span>
        )}
      </div>

      {/* 4. Lower Playback Container */}
      <div className="relative z-20 flex justify-center items-center gap-4 pb-6 mt-auto">
        <button 
          onClick={(e) => { e.stopPropagation(); playCrystalPing(); openModal('restartPhase'); }} 
          className="p-1.5 text-white/60 hover:text-aquamarine transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            playCrystalPing(); 
            if (!isPaused) silenceAll();
            setIsPaused(!isPaused); 
          }} 
          className="p-4 bg-white rounded-full text-black shadow-lg transition-transform hover:scale-105"
        >
          {isPaused ? <Play className="w-6 h-6 fill-black" /> : <Pause className="w-6 h-6 fill-black" />}
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); playCrystalPing(); openModal('skipPhase'); }} 
          className="p-1.5 text-white/60 hover:text-cyan transition-colors"
        >
          <StepForward className="w-5 h-5" />
        </button>
      </div>
      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-transparent backdrop-blur-[1.5px] flex items-center justify-center z-50 p-4">
          <div className="w-full max-sm text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Are you sure?</h3>
            <p className="text-aquamarine/60 mb-8">
              {modalAction === 'exit' && "Do you want to end the workout?"}
              {modalAction === 'skipExercise' && "Skip to the next exercise?"}
              {modalAction === 'skipPhase' && "Skip to the next phase?"}
              {modalAction === 'restartPhase' && "Restart the current phase?"}
            </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => { 
                  setIsModalOpen(false); 
                  setModalAction('none'); 
                  setIsPaused(false);
                }} 
                className="px-6 py-2 rounded-lg bg-transparent hover:bg-white/20 text-white transition-colors"
              >
                No
              </button>
              <button 
                onClick={handleModalConfirm} 
                className="px-6 py-2 rounded-lg bg-transparent hover:bg-cyan/40 text-cyan border border-cyan/50 transition-colors"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const safeStringify = (obj: any) => {
  return JSON.stringify(obj, (key, value) => {
    if (value && typeof value === 'object') {
      if (value.isMesh || value.isGroup) {
        return undefined;
      }
    }
    return value;
  });
};

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('MainMenu');
  const [builderSource, setBuilderSource] = useState<'planner' | 'library'>('planner');
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('palaestra_library');
    return saved ? JSON.parse(saved) : [];
  });

  // Builder Type
  const [builderType, setBuilderType] = useState<'HIIT' | 'Set' | 'Superset'>('HIIT');

  // HIIT Form state
  const [name, setName] = useState('');
  const [warmup, setWarmup] = useState<number | ''>('');
  const [hard, setHard] = useState<number | ''>('');
  const [easy, setEasy] = useState<number | ''>('');
  const [cooldown, setCooldown] = useState<number | ''>('');
  const [rounds, setRounds] = useState<number | ''>('');
  const [hardName, setHardName] = useState('');
  const [easyName, setEasyName] = useState('');
  
  const [warmupMetronome, setWarmupMetronome] = useState(false);
  const [warmupBpm, setWarmupBpm] = useState<number | ''>(120);
  const [hardMetronome, setHardMetronome] = useState(false);
  const [hardBpm, setHardBpm] = useState<number | ''>(120);
  const [easyMetronome, setEasyMetronome] = useState(false);
  const [easyBpm, setEasyBpm] = useState<number | ''>(120);
  const [cooldownMetronome, setCooldownMetronome] = useState(false);
  const [cooldownBpm, setCooldownBpm] = useState<number | ''>(120);

  // Set Form state
  const [setNameState, setSetNameState] = useState('');
  const [setSets, setSetSets] = useState<number | ''>('');
  const [setReps, setSetReps] = useState<number | ''>('');
  const [setMode, setSetMode] = useState<'manual' | 'time'>('manual');
  const [setRepDuration, setSetRepDuration] = useState<number | ''>('');
  const [setRestBetweenReps, setSetRestBetweenReps] = useState<number | ''>('');
  const [setRestBetweenSets, setSetRestBetweenSets] = useState<number | ''>('');
  const [setUseRepDuration, setSetUseRepDuration] = useState(false);
  const [setUseRestBetweenReps, setSetUseRestBetweenReps] = useState(false);
  const [setUseRestBetweenSets, setSetUseRestBetweenSets] = useState(false);

  // Superset Form state
  const [ssName, setSsName] = useState('');
  const [ssTotalSupersets, setSsTotalSupersets] = useState<number | ''>('');
  const [ssMode, setSsMode] = useState<'manual' | 'timed'>('manual');
  const [ssExerciseTransition, setSsExerciseTransition] = useState<number | ''>('');
  const [ssSupersetTransition, setSsSupersetTransition] = useState<number | ''>('');
  const [ssExercises, setSsExercises] = useState<{
    id: string;
    name: string;
    reps: number | '';
    mode: 'manual' | 'time';
    repDuration?: number | '';
    restBetweenReps?: number | '';
  }[]>([]);

  // Planner state
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutItem[]>(() => {
    const saved = localStorage.getItem('palaestra_workout');
    return saved ? JSON.parse(saved) : [];
  });
  const [workoutName, setWorkoutName] = useState(() => {
    return localStorage.getItem('palaestra_workoutName') || '';
  });
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>(() => {
    const saved = localStorage.getItem('palaestra_saved_workouts');
    return saved ? JSON.parse(saved) : [];
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [saveAndStartModal, setSaveAndStartModal] = useState<'none' | 'unnamed' | 'noExercises' | 'both'>('none');

  const getNextWorkoutName = () => {
    let i = 1;
    while (savedWorkouts.some(w => w.name === `Workout ${i}`)) {
      i++;
    }
    return `Workout ${i}`;
  };

  const saveAndStartWorkout = (name: string = workoutName) => {
    const nameToSave = name || 'Untitled Workout';
    const existingIndex = savedWorkouts.findIndex(w => w.name === nameToSave);
    if (existingIndex >= 0) {
      const updated = [...savedWorkouts];
      updated[existingIndex] = { ...updated[existingIndex], items: currentWorkout };
      setSavedWorkouts(updated);
    } else {
      const newWorkout = {
        id: crypto.randomUUID(),
        name: nameToSave,
        items: currentWorkout
      };
      setSavedWorkouts([...savedWorkouts, newWorkout]);
    }
    setCurrentView('WorkoutMode');
  };

  const handleSaveAndStart = () => {
    const isUnnamed = !workoutName || workoutName.trim() === '';
    const hasNoExercises = currentWorkout.length === 0;

    if (isUnnamed && hasNoExercises) {
      setSaveAndStartModal('both');
    } else if (isUnnamed) {
      setSaveAndStartModal('unnamed');
    } else if (hasNoExercises) {
      setSaveAndStartModal('noExercises');
    } else {
      saveAndStartWorkout();
    }
  };

  // Custom Builder state
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [customBuilderType, setCustomBuilderType] = useState<'HIIT' | 'Set' | 'Superset' | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setCurrentWorkout((items) => {
        const oldIndex = items.findIndex((i) => i.uniqueId === active.id);
        const newIndex = items.findIndex((i) => i.uniqueId === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  const [cbName, setCbName] = useState('');
  // HIIT fields
  const [cbWarmup, setCbWarmup] = useState<number | ''>('');
  const [cbHard, setCbHard] = useState<number | ''>('');
  const [cbEasy, setCbEasy] = useState<number | ''>('');
  const [cbCooldown, setCbCooldown] = useState<number | ''>('');
  const [cbRounds, setCbRounds] = useState<number | ''>('');
  const [cbHardName, setCbHardName] = useState('');
  const [cbEasyName, setCbEasyName] = useState('');
  
  const [cbWarmupMetronome, setCbWarmupMetronome] = useState(false);
  const [cbWarmupBpm, setCbWarmupBpm] = useState<number | ''>(120);
  const [cbHardMetronome, setCbHardMetronome] = useState(false);
  const [cbHardBpm, setCbHardBpm] = useState<number | ''>(120);
  const [cbEasyMetronome, setCbEasyMetronome] = useState(false);
  const [cbEasyBpm, setCbEasyBpm] = useState<number | ''>(120);
  const [cbCooldownMetronome, setCbCooldownMetronome] = useState(false);
  const [cbCooldownBpm, setCbCooldownBpm] = useState<number | ''>(120);
  // Set fields
  const [cbSets, setCbSets] = useState<number | ''>('');
  const [cbReps, setCbReps] = useState<number | ''>('');
  const [cbMode, setCbMode] = useState<'manual' | 'time'>('manual');
  const [cbRepDuration, setCbRepDuration] = useState<number | ''>('');
  const [cbRestBetweenReps, setCbRestBetweenReps] = useState<number | ''>('');
  const [cbRestBetweenSets, setCbRestBetweenSets] = useState<number | ''>('');
  const [cbUseRepDuration, setCbUseRepDuration] = useState(false);
  const [cbUseRestBetweenReps, setCbUseRestBetweenReps] = useState(false);
  const [cbUseRestBetweenSets, setCbUseRestBetweenSets] = useState(false);

  // Superset fields for custom builder
  const [cbSsTotalSupersets, setCbSsTotalSupersets] = useState<number | ''>('');
  const [cbSsMode, setCbSsMode] = useState<'manual' | 'timed'>('manual');
  const [cbSsExerciseTransition, setCbSsExerciseTransition] = useState<number | ''>('');
  const [cbSsSupersetTransition, setCbSsSupersetTransition] = useState<number | ''>('');
  const [cbSsExercises, setCbSsExercises] = useState<{
    id: string;
    name: string;
    reps: number | '';
    mode: 'manual' | 'time';
    repDuration?: number | '';
    restBetweenReps?: number | '';
  }[]>([]);

  useEffect(() => {
    localStorage.setItem('palaestra_library', safeStringify(exerciseLibrary));
  }, [exerciseLibrary]);

  useEffect(() => {
    localStorage.setItem('palaestra_workout', safeStringify(currentWorkout));
  }, [currentWorkout]);

  useEffect(() => {
    localStorage.setItem('palaestra_workoutName', workoutName);
  }, [workoutName]);

  useEffect(() => {
    localStorage.setItem('palaestra_saved_workouts', safeStringify(savedWorkouts));
  }, [savedWorkouts]);

  const editExercise = (item: WorkoutItem) => {
    setEditingExerciseId(item.uniqueId);
    setCustomBuilderType(item.exercise.type);
    setCbName(item.name);
    if (item.exercise.type === 'HIIT') {
      setCbWarmup(item.exercise.warmup);
      setCbHard(item.exercise.hard);
      setCbEasy(item.exercise.easy);
      setCbCooldown(item.exercise.cooldown);
      setCbRounds(item.exercise.rounds);
      setCbHardName(item.exercise.hardName || '');
      setCbEasyName(item.exercise.easyName || '');
    } else if (item.exercise.type === 'Set') {
      setCbSets(item.exercise.sets);
      setCbReps(item.exercise.reps);
      setCbMode(item.exercise.mode);
      setCbRepDuration(item.exercise.repDuration || '');
      setCbRestBetweenReps(item.exercise.restBetweenReps || '');
      setCbRestBetweenSets(item.exercise.restBetweenSets || '');
    } else if (item.exercise.type === 'Superset') {
      setCbSsTotalSupersets(item.exercise.totalSupersets);
      setCbSsMode(item.exercise.mode);
      setCbSsExerciseTransition(item.exercise.exerciseTransitionTimer || '');
      setCbSsSupersetTransition(item.exercise.supersetTransitionTimer || '');
      setCbSsExercises(item.exercise.exercises);
    }
  };

  const SortableExerciseItem = ({ item, index, editExercise, toggleExpand, removeItem, expandedItems }: { item: WorkoutItem, index: number, editExercise: (item: WorkoutItem) => void, toggleExpand: (id: string) => void, removeItem: (id: string) => void, expandedItems: Set<string> }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.uniqueId });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div ref={setNodeRef} style={style}>
        <div className="p-3 cursor-pointer" onClick={() => editExercise(item)}>
          <div className="flex items-center gap-3">
            <div className="text-white/20 cursor-grab" {...attributes} {...listeners}>
              <GripVertical className="w-5 h-5" />
            </div>
            <span className="text-aquamarine text-sm font-mono w-6 text-center">{index + 1}.</span>
            <div className="flex-grow">
              <span className="text-[10px] font-semibold bg-transparent text-aquamarine px-1.5 py-0.5 rounded block w-max">
                {item.exercise?.type || item.type}
              </span>
              <h4 className="text-sm font-bold text-white mt-1">
                {item.name}
              </h4>
            </div>
            <button onClick={(e) => { e.stopPropagation(); removeItem(item.uniqueId); }} className="p-1.5 text-stellar-ember hover:text-stellar-ember/80 bg-transparent hover:bg-transparent rounded-lg transition-colors border border-stellar-ember/20">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {expandedItems.has(item.uniqueId) && (
            <div className="mt-4 pt-4 border-t border-white/10 pl-14">
              {item.exercise ? (
                item.exercise.type === 'HIIT' ? (
                  <div className="grid grid-cols-5 gap-2 text-sm text-center max-w-2xl">
                    <div className="bg-transparent rounded p-2 border border-white/5">
                      <div className="text-aquamarine/70 text-xs mb-1">Warm</div>
                      <div className="font-mono">{item.exercise.warmup}</div>
                    </div>
                    <div className="bg-transparent rounded p-2 border border-white/5">
                      <div className="text-cyan/70 text-xs mb-1">Hard</div>
                      <div className="font-mono">{item.exercise.hard}</div>
                    </div>
                    <div className="bg-transparent rounded p-2 border border-white/5">
                      <div className="text-teal/70 text-xs mb-1">Easy</div>
                      <div className="font-mono">{item.exercise.easy}</div>
                    </div>
                    <div className="bg-transparent rounded p-2 border border-white/5">
                      <div className="text-cobalt/70 text-xs mb-1">Cool</div>
                      <div className="font-mono">{item.exercise.cooldown}</div>
                    </div>
                    <div className="bg-transparent rounded p-2 border border-cyan/30">
                      <div className="text-cyan/70 text-xs mb-1">Rounds</div>
                      <div className="font-mono">{item.exercise.rounds}x</div>
                    </div>
                  </div>
                ) : item.exercise.type === 'Set' ? (
                  <div className="grid grid-cols-4 gap-2 text-sm text-center max-w-2xl">
                    <div className="bg-transparent rounded p-2 border border-white/5">
                      <div className="text-aquamarine/70 text-xs mb-1">Sets</div>
                      <div className="font-mono">{item.exercise.sets}</div>
                    </div>
                    <div className="bg-transparent rounded p-2 border border-white/5">
                      <div className="text-cyan/70 text-xs mb-1">Reps</div>
                      <div className="font-mono">{item.exercise.reps}</div>
                    </div>
                    <div className="bg-transparent rounded p-2 border border-white/5">
                      <div className="text-teal/70 text-xs mb-1">Rest</div>
                      <div className="font-mono">{item.exercise.restBetweenSets}</div>
                    </div>
                    <div className="bg-transparent rounded p-2 border border-cyan/30">
                      <div className="text-cyan/70 text-xs mb-1 capitalize">Mode</div>
                      <div className="font-mono">{item.exercise.mode}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-2xl">
                    <div className="grid grid-cols-3 gap-2 text-sm text-center">
                      <div className="bg-transparent rounded p-2 border border-white/5">
                        <div className="text-aquamarine/70 text-xs mb-1">Rounds</div>
                        <div className="font-mono">{item.exercise.totalSupersets}x</div>
                      </div>
                      <div className="bg-transparent rounded p-2 border border-white/5">
                        <div className="text-cyan/70 text-xs mb-1">Exercises</div>
                        <div className="font-mono">{item.exercise.exercises.length}</div>
                      </div>
                      <div className="bg-transparent rounded p-2 border border-white/5">
                        <div className="text-teal/70 text-xs mb-1 capitalize">Mode</div>
                        <div className="font-mono">{item.exercise.mode}</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {item.exercise.exercises.map((e, i) => (
                        <div key={e.id} className="text-xs flex justify-between items-center bg-transparent px-3 py-1.5 rounded border border-white/5">
                          <span className="text-aquamarine">{e.name}</span>
                          <span className="text-aquamarine/70 font-mono">{e.reps} reps • {e.mode}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <p className="text-aquamarine/60 italic">Placeholder details for {item.type} exercise. Configure in builder.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleSaveCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBuilderType) return;

    let newExercise: Exercise;

    if (customBuilderType === 'HIIT') {
      if (!cbName || cbWarmup === '' || cbHard === '' || cbEasy === '' || cbCooldown === '' || cbRounds === '') {
        alert('Please fill in all fields');
        return;
      }
      newExercise = {
        id: editingExerciseId ? currentWorkout.find(i => i.uniqueId === editingExerciseId)?.exercise.id || crypto.randomUUID() : crypto.randomUUID(),
        name: cbName,
        type: 'HIIT',
        warmup: Number(cbWarmup),
        hard: Number(cbHard),
        easy: Number(cbEasy),
        cooldown: Number(cbCooldown),
        rounds: Number(cbRounds),
        hardName: cbHardName.trim() || 'PHASE 1',
        easyName: cbEasyName.trim() || 'PHASE 2',
        metronome: {
          warmup: { enabled: cbWarmupMetronome, bpm: Number(cbWarmupBpm) || 120 },
          hard: { enabled: cbHardMetronome, bpm: Number(cbHardBpm) || 120 },
          easy: { enabled: cbEasyMetronome, bpm: Number(cbEasyBpm) || 120 },
          cooldown: { enabled: cbCooldownMetronome, bpm: Number(cbCooldownBpm) || 120 },
        }
      };
    } else if (customBuilderType === 'Set') {
      if (!cbName || cbSets === '' || cbReps === '') {
        alert('Please fill in all required fields');
        return;
      }
      newExercise = {
        id: editingExerciseId ? currentWorkout.find(i => i.uniqueId === editingExerciseId)?.exercise.id || crypto.randomUUID() : crypto.randomUUID(),
        name: cbName,
        type: 'Set',
        sets: Number(cbSets),
        reps: Number(cbReps),
        mode: cbMode,
        repDuration: (cbMode === 'time' && cbUseRepDuration) ? Number(cbRepDuration) : undefined,
        restBetweenReps: (cbMode === 'time' && cbUseRestBetweenReps) ? Number(cbRestBetweenReps) : undefined,
        restBetweenSets: (cbMode === 'time' && cbUseRestBetweenSets) ? Number(cbRestBetweenSets) : undefined,
      };
    } else if (customBuilderType === 'Superset') {
      if (!cbName || cbSsTotalSupersets === '' || cbSsExercises.length === 0) {
        alert('Please fill in all required fields and add at least one exercise');
        return;
      }
      newExercise = {
        id: editingExerciseId ? currentWorkout.find(i => i.uniqueId === editingExerciseId)?.exercise.id || crypto.randomUUID() : crypto.randomUUID(),
        name: cbName,
        type: 'Superset',
        totalSupersets: Number(cbSsTotalSupersets),
        mode: cbSsMode,
        exerciseTransitionTimer: cbSsMode === 'timed' ? Number(cbSsExerciseTransition) : undefined,
        supersetTransitionTimer: cbSsMode === 'timed' ? Number(cbSsSupersetTransition) : undefined,
        exercises: cbSsExercises.map(ex => ({
          id: ex.id,
          name: ex.name,
          reps: Number(ex.reps),
          mode: ex.mode,
          repDuration: ex.repDuration ? Number(ex.repDuration) : undefined,
          restBetweenReps: ex.restBetweenReps ? Number(ex.restBetweenReps) : undefined,
        }))
      };
    } else {
      return;
    }

    if (editingExerciseId) {
      setCurrentWorkout(prev => prev.map(i => i.uniqueId === editingExerciseId ? { ...i, name: newExercise.name, exercise: newExercise } : i));
    } else {
      setCurrentWorkout(prev => [...prev, {
        uniqueId: crypto.randomUUID(),
        name: cbName,
        type: customBuilderType,
        exercise: newExercise
      }]);
    }
    
    setEditingExerciseId(null);
    setCustomBuilderType(null);
    setCbName('');
    setCbWarmup('');
    setCbHard('');
    setCbEasy('');
    setCbCooldown('');
    setCbRounds('');
    setCbHardName('');
    setCbEasyName('');
    setCbSets('');
    setCbReps('');
    setCbMode('manual');
    setCbRepDuration('');
    setCbRestBetweenReps('');
    setCbRestBetweenSets('');
    setCbUseRepDuration(false);
    setCbUseRestBetweenReps(false);
    setCbUseRestBetweenSets(false);
    setCbSsTotalSupersets('');
    setCbSsMode('manual');
    setCbSsExerciseTransition('');
    setCbSsSupersetTransition('');
    setCbSsExercises([]);
    setCbWarmupMetronome(false);
    setCbWarmupBpm(120);
    setCbHardMetronome(false);
    setCbHardBpm(120);
    setCbEasyMetronome(false);
    setCbEasyBpm(120);
    setCbCooldownMetronome(false);
    setCbCooldownBpm(120);
  };

  const addFromLibrary = (ex: Exercise) => {
    setCurrentWorkout(prev => [...prev, {
      uniqueId: crypto.randomUUID(),
      name: ex.name,
      type: 'Library',
      exercise: ex
    }]);
    setShowLibrary(false);
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    if (index + dir < 0 || index + dir >= currentWorkout.length) return;
    const newWorkout = [...currentWorkout];
    const temp = newWorkout[index];
    newWorkout[index] = newWorkout[index + dir];
    newWorkout[index + dir] = temp;
    setCurrentWorkout(newWorkout);
  };

  const removeItem = (uniqueId: string) => {
    setCurrentWorkout(currentWorkout.filter(item => item.uniqueId !== uniqueId));
  };

  const toggleExpand = (uniqueId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(uniqueId)) {
      newExpanded.delete(uniqueId);
    } else {
      newExpanded.add(uniqueId);
    }
    setExpandedItems(newExpanded);
  };

  const handleSaveExercise = (e?: React.FormEvent): HIITExercise | null => {
    if (e) e.preventDefault();
    if (!name || warmup === '' || hard === '' || easy === '' || cooldown === '' || rounds === '') {
      alert('Please fill in all fields');
      return null;
    }

    const newExercise: HIITExercise = {
      id: crypto.randomUUID(),
      name,
      type: 'HIIT',
      warmup: Number(warmup),
      hard: Number(hard),
      easy: Number(easy),
      cooldown: Number(cooldown),
      rounds: Number(rounds),
      hardName: hardName.trim() || 'PHASE 1',
      easyName: easyName.trim() || 'PHASE 2',
      metronome: {
        warmup: { enabled: warmupMetronome, bpm: Number(warmupBpm) || 120 },
        hard: { enabled: hardMetronome, bpm: Number(hardBpm) || 120 },
        easy: { enabled: easyMetronome, bpm: Number(easyBpm) || 120 },
        cooldown: { enabled: cooldownMetronome, bpm: Number(cooldownBpm) || 120 },
      }
    };

    setExerciseLibrary([...exerciseLibrary, newExercise]);
    
    // Reset form
    setName('');
    setWarmup('');
    setHard('');
    setEasy('');
    setCooldown('');
    setRounds('');
    setHardName('');
    setEasyName('');
    setWarmupMetronome(false);
    setWarmupBpm(120);
    setHardMetronome(false);
    setHardBpm(120);
    setEasyMetronome(false);
    setEasyBpm(120);
    setCooldownMetronome(false);
    setCooldownBpm(120);
    return newExercise;
  };

  const handleSaveSupersetExercise = (e?: React.FormEvent): SupersetExercise | null => {
    if (e) e.preventDefault();
    if (!ssName || ssTotalSupersets === '' || ssExercises.length === 0) {
      alert('Please fill in all required fields and add at least one exercise');
      return null;
    }

    const newExercise: SupersetExercise = {
      id: crypto.randomUUID(),
      name: ssName,
      type: 'Superset',
      totalSupersets: Number(ssTotalSupersets),
      mode: ssMode,
      exerciseTransitionTimer: ssMode === 'timed' ? Number(ssExerciseTransition) : undefined,
      supersetTransitionTimer: ssMode === 'timed' ? Number(ssSupersetTransition) : undefined,
      exercises: ssExercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        reps: Number(ex.reps),
        mode: ex.mode,
        repDuration: ex.repDuration ? Number(ex.repDuration) : undefined,
        restBetweenReps: ex.restBetweenReps ? Number(ex.restBetweenReps) : undefined,
      }))
    };

    setExerciseLibrary([...exerciseLibrary, newExercise]);
    
    // Reset form
    setSsName('');
    setSsTotalSupersets('');
    setSsMode('manual');
    setSsExerciseTransition('');
    setSsSupersetTransition('');
    setSsExercises([]);
    return newExercise;
  };

  const handleSaveSetExercise = (e?: React.FormEvent): SetExercise | null => {
    if (e) e.preventDefault();
    if (!setNameState || setSets === '' || setReps === '') {
      alert('Please fill in all required fields');
      return null;
    }

    if (Number(setSets) < 1 || Number(setReps) < 1) {
      alert('Sets and Reps must be at least 1');
      return null;
    }

    const newExercise: SetExercise = {
      id: crypto.randomUUID(),
      name: setNameState,
      type: 'Set',
      sets: Number(setSets),
      reps: Number(setReps),
      mode: setMode,
      repDuration: (setMode === 'time' && setUseRepDuration) ? Number(setRepDuration) : undefined,
      restBetweenReps: (setMode === 'time' && setUseRestBetweenReps) ? Number(setRestBetweenReps) : undefined,
      restBetweenSets: (setMode === 'time' && setUseRestBetweenSets) ? Number(setRestBetweenSets) : undefined,
    };

    setExerciseLibrary([...exerciseLibrary, newExercise]);
    
    // Reset form
    setSetNameState('');
    setSetSets('');
    setSetReps('');
    setSetMode('manual');
    setSetRepDuration('');
    setSetRestBetweenReps('');
    setSetRestBetweenSets('');
    setSetUseRepDuration(false);
    setSetUseRestBetweenReps(false);
    setSetUseRestBetweenSets(false);
    return newExercise;
  };

  const handleUnifiedSave = (action: 'new' | 'workout' | 'library') => {
    let newExercise = null;
    if (builderType === 'HIIT') newExercise = handleSaveExercise();
    else if (builderType === 'Set') newExercise = handleSaveSetExercise();
    else if (builderType === 'Superset') newExercise = handleSaveSupersetExercise();

    if (newExercise) {
      if (action === 'workout') {
        setCurrentWorkout(prev => [...prev, {
          uniqueId: crypto.randomUUID(),
          name: newExercise.name,
          type: 'Library',
          exercise: newExercise
        }]);
        setCurrentView('WorkoutPlanner');
      } else if (action === 'library') {
        setCurrentView('ExerciseLibrary');
      }
    }
  };

  const [buttonHoleMask, setButtonHoleMask] = useState<string>('');
  const [buttonHoleOverlay, setButtonHoleOverlay] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  const updateButtonHoles = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const buttons = container.querySelectorAll('.container-button-hole');
    
    if (buttons.length === 0) {
      setButtonHoleMask('');
      setButtonHoleOverlay('');
      return;
    }

    let maskRects = '';
    let borderRects = '';
    buttons.forEach(btn => {
      const btnRect = btn.getBoundingClientRect();
      const padding = -0.5;
      const x = btnRect.left - rect.left - padding;
      const y = btnRect.top - rect.top - padding;
      const width = btnRect.width + padding * 2;
      const height = btnRect.height + padding * 2;
      const style = window.getComputedStyle(btn);
      let rxVal = 8;
      if (style.borderRadius) {
        const parsed = parseFloat(style.borderRadius);
        if (!isNaN(parsed)) rxVal = parsed;
      }
      const rx = rxVal + padding;
      // In an SVG mask, black hides and white shows.
      // We want the background to be white (show blur) and buttons to be black (hide blur/create hole).
      maskRects += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="black" />`;
      borderRects += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="none" stroke="white" stroke-width="1" />`;
    });

    // We use a mask definition to subtract the button areas from a solid white rectangle.
    // The resulting SVG will have alpha transparency where the buttons are.
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
      <defs>
        <mask id="hole-mask">
          <rect width="100%" height="100%" fill="white" />
          ${maskRects}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="white" mask="url(#hole-mask)" />
    </svg>`;
    
    const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
      ${borderRects}
    </svg>`;
    
    setButtonHoleMask(`url("data:image/svg+xml,${encodeURIComponent(maskSvg)}")`);
    setButtonHoleOverlay(`url("data:image/svg+xml,${encodeURIComponent(overlaySvg)}")`);
  }, []);

  useLayoutEffect(() => {
    updateButtonHoles();
    const timer = setTimeout(updateButtonHoles, 50);
    return () => clearTimeout(timer);
  }, [currentView, customBuilderType, builderType, currentWorkout, updateButtonHoles]);

  useEffect(() => {
    window.addEventListener('resize', updateButtonHoles);
    return () => window.removeEventListener('resize', updateButtonHoles);
  }, [updateButtonHoles]);

  const renderView = () => {
    switch (currentView) {
      case 'MainMenu':
        return (
          <div className="relative min-h-screen overflow-hidden">
            <CosmicFlow phase={null} isPaused={false} status="active" />
            <div className="relative z-10 grid grid-cols-2 grid-rows-3 min-h-screen w-full p-4 sm:p-8 md:p-12">
              {/* Row 1: Header */}
              <div className="row-start-1 col-span-2 flex flex-col items-center justify-center">
                <div className="text-center relative w-full px-4">
                  <div className="relative inline-flex flex-col items-center">
                    <motion.h1 
                      initial={{ opacity: 0, letterSpacing: "0.2em", filter: "blur(10px)", scale: 1.1 }}
                      animate={{ opacity: 1, letterSpacing: "-0.05em", filter: "blur(0px)", scale: 1 }}
                      transition={{ 
                        duration: 2, 
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="relative text-[18vw] sm:text-8xl md:text-9xl lg:text-[10rem] font-black tracking-tighter uppercase italic py-8 px-4 overflow-visible"
                      style={{ 
                        background: 'linear-gradient(to bottom, #FF8C00 0%, #FF6B00 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(255,140,0,0.3))',
                        WebkitTextStroke: "1px rgba(255,255,255,0.1)",
                      }}
                    >
                      ΛLTIS
                    </motion.h1>
                  </div>
                  
                  <p className="text-xl md:text-2xl text-teal tracking-[0.3em] uppercase drop-shadow-[0_0_8px_rgba(0,191,165,0.6)] -mt-4 font-medium">
                    Workout Assistant
                  </p>
                </div>
              </div>

              {/* Row 2: Workout Button (The Peak) */}
              <div className="row-start-2 col-span-2 relative">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
                  <AccretionDisk size={112} color="#00E676" />
                  <div 
                    onClick={() => setCurrentView('Workouts')}
                    className="relative z-40 flex flex-col items-center justify-center p-0 group w-28 h-28 rounded-full border border-formula-green bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_15px_rgba(0,230,118,0.2)] hover:shadow-[0_0_25px_rgba(0,230,118,0.4)]"
                  >
                    <ListPlus className="w-8 h-8 mb-1 text-formula-green group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(0,230,118,0.4)]" />
                    <h2 className="text-xs font-bold text-white group-hover:text-formula-green transition-colors drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] text-center">
                      Workout
                    </h2>
                  </div>
                </div>
              </div>

              {/* Row 3: Workout Assistant and Library */}
              <div className="row-start-3 col-start-1 flex items-start justify-start relative">
                <div className="relative">
                  <AccretionDisk size={96} color="#967BB6" />
                  <div 
                    onClick={() => setCurrentView('WorkoutPlanner')}
                    className="relative z-40 flex flex-col items-center justify-center p-0 group w-24 h-24 rounded-full border border-nebula-lavender bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_15px_rgba(150,123,182,0.2)] hover:shadow-[0_0_25px_rgba(150,123,182,0.4)]"
                  >
                    <ClipboardList className="w-6 h-6 mb-1 text-nebula-lavender group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_5px_rgba(150,123,182,0.3)]" />
                    <h2 className="text-[9px] font-bold text-white group-hover:text-nebula-lavender transition-colors drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] text-center leading-tight max-w-[60px]">
                      Workout Designer
                    </h2>
                  </div>
                </div>
              </div>

              <div className="row-start-3 col-start-2 flex items-start justify-end relative">
                <div className="relative">
                  <AccretionDisk size={96} color="#00E5FF" />
                  <div 
                    onClick={() => setCurrentView('ExerciseLibrary')}
                    className="relative z-40 flex flex-col items-center justify-center p-0 group w-24 h-24 rounded-full border border-cyan bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_15px_rgba(0,229,255,0.2)] hover:shadow-[0_0_25px_rgba(0,229,255,0.4)]"
                  >
                    <Book className="w-6 h-6 mb-1 text-cyan group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_5px_rgba(0,229,255,0.3)]" />
                    <h2 className="text-[9px] font-bold text-white group-hover:text-cyan transition-colors drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] text-center leading-tight max-w-[60px]">
                      Exercise Library
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'Workouts':
        return (
          <div className="relative min-h-screen overflow-hidden">
            <CosmicFlow phase={null} isPaused={false} status="active" />
            <div className="relative z-10 p-6 md:p-12 max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div 
                  onClick={() => setCurrentView('MainMenu')}
                  className="px-4 py-1.5 flex items-center gap-2 group border border-aquamarine bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(127,255,212,0.2)] hover:shadow-[0_0_20px_rgba(127,255,212,0.4)]"
                >
                  <X className="w-4 h-4 text-aquamarine group-hover:text-white transition-colors" />
                  <span className="text-xs font-bold text-aquamarine group-hover:text-white transition-colors uppercase tracking-widest">Exit</span>
                </div>

                <div className="relative">
                  <AccretionDisk size={56} color="#7FFFD4" />
                  <div 
                    onClick={() => {
                      setCurrentWorkout([]);
                      setWorkoutName('');
                      setCurrentView('WorkoutPlanner');
                    }}
                    className="relative z-40 w-12 h-12 rounded-full flex items-center justify-center p-0 group border border-aquamarine bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(127,255,212,0.2)] hover:shadow-[0_0_20px_rgba(127,255,212,0.4)]"
                    title="Add New Workout"
                  >
                    <Plus className="w-6 h-6 text-aquamarine group-hover:text-white group-hover:scale-110 transition-all duration-300 drop-shadow-[0_0_8px_rgba(127,255,212,0.4)]" />
                  </div>
                </div>
              </div>

              <div className="relative z-20 mb-4 text-center">
                <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cobalt to-cyan text-transparent bg-clip-text uppercase italic tracking-tighter leading-tight">
                  Saved Workouts
                </h2>
                <p className="text-aquamarine/60 text-sm tracking-[0.2em] uppercase mt-1">Your Training Archive</p>
              </div>

              <div className="relative z-30 p-6 border border-white rounded-2xl bg-black/40 backdrop-blur-md">
                {savedWorkouts.length === 0 ? (
                  <div className="flex justify-center py-4">
                    <div className="relative">
                      <AccretionDisk size={200} color="#00E5FF" className="opacity-10" />
                      <div className="relative z-40 max-w-md w-full text-center py-8 px-6 flex flex-col items-center justify-center border-white/5 rounded-[2rem]">
                        <div className="w-16 h-16 rounded-full bg-transparent border border-cyan/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                          <ClipboardList className="w-8 h-8 text-cyan drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
                        </div>
                        <p className="text-lg font-bold text-white tracking-tight mb-2">No saved workouts yet.</p>
                        <p className="text-aquamarine/60 text-sm leading-relaxed">
                          Add your first workout in the workout planner.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {savedWorkouts.map(workout => (
                        <div key={workout.id} className="flex flex-col h-full bg-transparent">
                        <h3 className="text-xl font-bold text-white mb-2">{workout.name}</h3>
                        <p className="text-aquamarine text-sm mb-4">{workout.items.length} exercises</p>
                        <div className="mt-auto flex gap-2">
                          <button 
                            onClick={() => {
                              setCurrentWorkout(workout.items);
                              setWorkoutName(workout.name);
                              setCurrentView('WorkoutPlanner');
                            }}
                            className={`flex-1 bg-transparent backdrop-blur-none hover:bg-transparent border border-cobalt/50 text-aquamarine py-2 rounded-lg transition-colors flex justify-center items-center ${CONTAINER_BUTTON_CLASS}`}
                          >
                            <Play className="w-4 h-4 mr-2" /> Load
                          </button>
                          <button 
                            onClick={() => {
                              setSavedWorkouts(savedWorkouts.filter(w => w.id !== workout.id));
                            }}
                            className={`p-2 text-stellar-ember hover:text-stellar-ember/80 bg-transparent backdrop-blur-none hover:bg-transparent rounded-lg transition-colors border border-stellar-ember/30 ${CONTAINER_BUTTON_CLASS}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'ExerciseBuilder':
        return (
          <div className="relative min-h-screen overflow-hidden">
            <CosmicFlow phase={null} isPaused={false} status="active" />
            <div className="relative z-10 p-6 md:p-12 max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div 
                  onClick={() => setCurrentView('MainMenu')}
                  className="px-4 py-1.5 flex items-center gap-2 group border border-aquamarine bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(127,255,212,0.2)] hover:shadow-[0_0_20px_rgba(127,255,212,0.4)]"
                >
                  <X className="w-4 h-4 text-aquamarine group-hover:text-white transition-colors" />
                  <span className="text-xs font-bold text-aquamarine group-hover:text-white transition-colors uppercase tracking-widest">Exit</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <AccretionDisk size={56} color="#00E5FF" />
                    <div 
                      onClick={() => setCurrentView('ExerciseLibrary')}
                      className="relative z-40 w-12 h-12 rounded-full flex items-center justify-center p-0 group border border-cyan bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(0,229,255,0.2)] hover:shadow-[0_0_20px_rgba(0,229,255,0.4)]"
                      title="Exercise Library"
                    >
                      <Book className="w-5 h-5 text-cyan group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-40 mb-4 text-center">
                <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cobalt to-cyan text-transparent bg-clip-text uppercase italic tracking-tighter leading-tight">
                  Exercise Builder
                </h2>
              </div>

              <div ref={containerRef} className="max-w-2xl mx-auto relative z-30 overflow-hidden border border-white rounded-2xl">
                {/* Background Layer with Mask */}
                <div 
                  className="absolute inset-0 bg-black/40 backdrop-blur-md z-0"
                  style={{ maskImage: buttonHoleMask, WebkitMaskImage: buttonHoleMask }}
                />
                {/* Overlay Layer for White Borders */}
                <div 
                  className="absolute inset-0 z-50 pointer-events-none"
                  style={{ backgroundImage: buttonHoleOverlay }}
                />
                
                {/* Content Layer */}
                <div className="relative z-40">
                  {/* Title & Button Section */}
                <div className="p-6 bg-transparent border-b border-white/5 flex flex-col items-center gap-4">
                  <h3 className="text-base md:text-lg font-semibold text-aquamarine m-0 text-center uppercase tracking-wider">Add an Exercise</h3>
                  <div className="flex justify-center gap-2">
                    <button 
                      onClick={() => setBuilderType('HIIT')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors border ${builderType === 'HIIT' ? 'text-aquamarine border-aquamarine' : 'text-cyan border-cyan'} ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                    >
                      HIIT
                    </button>
                    <button 
                      onClick={() => setBuilderType('Set')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors border ${builderType === 'Set' ? 'text-aquamarine border-aquamarine' : 'text-cyan border-cyan'} ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                    >
                      Set
                    </button>
                    <button 
                      onClick={() => setBuilderType('Superset')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors border ${builderType === 'Superset' ? 'text-aquamarine border-aquamarine' : 'text-cyan border-cyan'} ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                    >
                      Superset
                    </button>
                  </div>
                  <button onClick={() => setShowLibrary(true)} className={`text-aquamarine border border-aquamarine px-2 py-0.5 text-xs rounded-md transition-colors flex items-center justify-center w-fit ${CONTAINER_BUTTON_CLASS} container-button-hole`}>
                    <ListPlus className="w-3 h-3 mr-1" /> Add from Library
                  </button>
                </div>

                {/* Form Section */}
                <div className="p-6 bg-transparent border-t border-white/5">
                  {builderType === 'HIIT' ? (
                  <>
                    <form onSubmit={handleSaveExercise} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-aquamarine mb-1">Exercise Name</label>
                        <input 
                          type="text" 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onFocus={() => setName('')}
                          className="bg-transparent border border-white/20 text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                          placeholder="-enter name-"
                          required
                        />
                      </div>
                      
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-aquamarine mb-1">Warmup</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="0"
                              value={warmup}
                              onChange={(e) => setWarmup(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setWarmup('')}
                              className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-aquamarine mb-1">Cooldown</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="0"
                              value={cooldown}
                              onChange={(e) => setCooldown(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setCooldown('')}
                              className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-aquamarine mb-1">Work</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="1"
                              value={hard}
                              onChange={(e) => setHard(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setHard('')}
                              className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-aquamarine mb-1">Rest</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="1"
                              value={easy}
                              onChange={(e) => setEasy(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setEasy('')}
                              className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                              required
                            />
                          </div>
                        </div>

                      <div>
                        <label className="block text-xs font-medium text-aquamarine mb-1">Number of Rounds</label>
                        <input 
                          type="number" 
                          inputMode="numeric"
                          min="1"
                          value={rounds}
                          onChange={(e) => setRounds(e.target.value === '' ? '' : Number(e.target.value))}
                          onFocus={() => setRounds('')}
                          className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                          placeholder="5"
                          required
                        />
                      </div>

                      <div className="space-y-3 pt-4 border-t border-white/10">
                        <h4 className="text-sm font-medium text-aquamarine uppercase tracking-wider">Metronome Settings</h4>
                        {[
                          { label: 'Warmup', enabled: warmupMetronome, setEnabled: setWarmupMetronome, bpm: warmupBpm, setBpm: setWarmupBpm },
                          { label: 'Hard', enabled: hardMetronome, setEnabled: setHardMetronome, bpm: hardBpm, setBpm: setHardBpm },
                          { label: 'Easy', enabled: easyMetronome, setEnabled: setEasyMetronome, bpm: easyBpm, setBpm: setEasyBpm },
                          { label: 'Cooldown', enabled: cooldownMetronome, setEnabled: setCooldownMetronome, bpm: cooldownBpm, setBpm: setCooldownBpm },
                        ].map((p) => (
                          <div key={p.label} className="flex items-center justify-between p-3 bg-transparent rounded-xl border border-white/10">
                            <button
                              type="button"
                              onClick={() => p.setEnabled(!p.enabled)}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${p.enabled ? 'bg-cobalt text-white shadow-[0_0_10px_rgba(0,71,171,0.5)]' : 'bg-transparent text-white/40'}`}
                            >
                              {p.label}
                            </button>
                            {p.enabled && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-aquamarine uppercase">BPM</span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={p.bpm}
                                  onChange={(e) => p.setBpm(e.target.value === '' ? '' : Number(e.target.value))}
                                  onFocus={() => p.setBpm('')}
                                  className="w-16 bg-transparent border border-white/20 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </form>
                  </>
                ) : builderType === 'Set' ? (
                  <>
                    <form onSubmit={handleSaveSetExercise} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-aquamarine mb-1">Exercise Name</label>
                        <input 
                          type="text" 
                          value={setNameState}
                          onChange={(e) => setSetNameState(e.target.value)}
                          onFocus={() => setSetNameState('')}
                          className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                          placeholder="-enter name-"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-aquamarine mb-1">Total Sets</label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            min="1"
                            value={setSets}
                            onChange={(e) => setSetSets(e.target.value === '' ? '' : Number(e.target.value))}
                            onFocus={() => setSetSets('')}
                            className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                            placeholder="3"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-aquamarine mb-1">Reps per Set</label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            min="1"
                            value={setReps}
                            onChange={(e) => setSetReps(e.target.value === '' ? '' : Number(e.target.value))}
                            onFocus={() => setSetReps('')}
                            className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                            placeholder="10"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-aquamarine mb-2">Mode Selection</label>
                        <div className="flex gap-2">
                          {(['manual', 'time'] as const).map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setSetMode(m)}
                              className={`flex-1 py-2 rounded-lg border transition-colors capitalize backdrop-blur-none ${setMode === m ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60 hover:bg-transparent'}`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {setMode === 'time' && (
                        <div className="space-y-4 p-4 bg-transparent rounded-lg border border-white/5">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSetUseRepDuration(!setUseRepDuration)}
                              className={`flex-1 py-2 text-xs rounded-lg border transition-colors backdrop-blur-none ${setUseRepDuration ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60'}`}
                            >
                              Rep Duration
                            </button>
                            <button
                              type="button"
                              onClick={() => setSetUseRestBetweenReps(!setUseRestBetweenReps)}
                              className={`flex-1 py-2 text-xs rounded-lg border transition-colors backdrop-blur-none ${setUseRestBetweenReps ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60'}`}
                            >
                              Rest Between Reps
                            </button>
                            <button
                              type="button"
                              onClick={() => setSetUseRestBetweenSets(!setUseRestBetweenSets)}
                              className={`flex-1 py-2 text-xs rounded-lg border transition-colors backdrop-blur-none ${setUseRestBetweenSets ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60'}`}
                            >
                              Rest Between Sets
                            </button>
                          </div>

                          <div className="space-y-3">
                            {setUseRepDuration && (
                              <div>
                                <label className="block text-xs font-medium text-aquamarine mb-1">Rep Duration</label>
                                <input 
                                  type="number" 
                                  inputMode="numeric"
                                  min="1"
                                  value={setRepDuration}
                                  onChange={(e) => setSetRepDuration(e.target.value === '' ? '' : Number(e.target.value))}
                                  onFocus={() => setSetRepDuration('')}
                                  className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                                  placeholder="0:60"
                                  required
                                />
                              </div>
                            )}
                            {setUseRestBetweenReps && (
                              <div>
                                <label className="block text-xs font-medium text-aquamarine mb-1">Rest Between Reps</label>
                                <input 
                                  type="number" 
                                  inputMode="numeric"
                                  min="1"
                                  value={setRestBetweenReps}
                                  onChange={(e) => setSetRestBetweenReps(e.target.value === '' ? '' : Number(e.target.value))}
                                  onFocus={() => setSetRestBetweenReps('')}
                                  className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                                  placeholder="0:60"
                                  required
                                />
                              </div>
                            )}
                            {setUseRestBetweenSets && (
                              <div>
                                <label className="block text-xs font-medium text-aquamarine mb-1">Rest Between Sets</label>
                                <input 
                                  type="number" 
                                  inputMode="numeric"
                                  min="1"
                                  value={setRestBetweenSets}
                                  onChange={(e) => setSetRestBetweenSets(e.target.value === '' ? '' : Number(e.target.value))}
                                  onFocus={() => setSetRestBetweenSets('')}
                                  className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                                  placeholder="0:60"
                                  required
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </form>
                  </>
                ) : (
                  <>
                    <form onSubmit={handleSaveSupersetExercise} className="space-y-6">
                      <div>
                        <label className="block text-xs font-medium text-aquamarine mb-1">Superset Name</label>
                        <input 
                          type="text" 
                          value={ssName}
                          onChange={(e) => setSsName(e.target.value)}
                          onFocus={() => setSsName('')}
                          className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                          placeholder="-enter name-"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-aquamarine mb-1">Number of Supersets (Rounds)</label>
                        <input 
                          type="number" 
                          inputMode="numeric"
                          min="1"
                          value={ssTotalSupersets}
                          onChange={(e) => setSsTotalSupersets(e.target.value === '' ? '' : Number(e.target.value))}
                          onFocus={() => setSsTotalSupersets('')}
                          className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                          placeholder="3"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-aquamarine mb-2">Superset Mode</label>
                        <div className="flex gap-2">
                          {(['manual', 'timed'] as const).map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setSsMode(m)}
                              className={`flex-1 py-2 rounded-lg border transition-colors capitalize backdrop-blur-none ${ssMode === m ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60 hover:bg-transparent'}`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {ssMode === 'timed' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-aquamarine mb-1">Exercise Transition</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="0"
                              value={ssExerciseTransition}
                              onChange={(e) => setSsExerciseTransition(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setSsExerciseTransition('')}
                              className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-aquamarine mb-1">Superset Rest</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="0"
                              value={ssSupersetTransition}
                              onChange={(e) => setSsSupersetTransition(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setSsSupersetTransition('')}
                              className="w-full bg-transparent border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                            />
                          </div>
                        </div>
                      )}

                        <div className="space-y-4">
                          <h4 className="text-lg font-medium text-aquamarine">Exercises</h4>

                          {ssExercises.map((ex, idx) => (
                            <div key={ex.id} className="p-4 bg-transparent border border-white/10 rounded-xl space-y-4 relative group">
                              <button
                                type="button"
                                onClick={() => setSsExercises(ssExercises.filter(e => e.id !== ex.id))}
                                className="absolute top-4 right-4 text-white/20 hover:text-stellar-ember transition-colors"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-aquamarine mb-1">Exercise Name</label>
                                    <input 
                                      type="text" 
                                      value={ex.name}
                                      onChange={(e) => {
                                        const newExs = [...ssExercises];
                                        newExs[idx].name = e.target.value;
                                        setSsExercises(newExs);
                                      }}
                                      onFocus={() => {
                                        const newExs = [...ssExercises];
                                        newExs[idx].name = '';
                                        setSsExercises(newExs);
                                      }}
                                      className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan transition-all"
                                      placeholder="-enter name-"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-aquamarine mb-1">Reps</label>
                                    <input 
                                      type="number" 
                                      inputMode="numeric"
                                      min="1"
                                      value={ex.reps}
                                      onChange={(e) => {
                                        const newExs = [...ssExercises];
                                        newExs[idx].reps = e.target.value === '' ? '' : Number(e.target.value);
                                        setSsExercises(newExs);
                                      }}
                                      onFocus={() => {
                                        const newExs = [...ssExercises];
                                        newExs[idx].reps = '';
                                        setSsExercises(newExs);
                                      }}
                                      className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan transition-all"
                                      placeholder="12"
                                      required
                                    />
                                  </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-aquamarine mb-2">Mode</label>
                                <div className="flex gap-2">
                                  {(['manual', 'time'] as const).map(m => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => {
                                        const newExs = [...ssExercises];
                                        newExs[idx].mode = m;
                                        setSsExercises(newExs);
                                      }}
                                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize backdrop-blur-none ${ex.mode === m ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60 hover:bg-transparent'}`}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {ex.mode === 'time' && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-aquamarine mb-1">Rep Duration</label>
                                    <input 
                                      type="number" 
                                      inputMode="numeric"
                                      min="1"
                                      value={ex.repDuration || ''}
                                      onChange={(e) => {
                                        const newExs = [...ssExercises];
                                        newExs[idx].repDuration = e.target.value === '' ? '' : Number(e.target.value);
                                        setSsExercises(newExs);
                                      }}
                                      className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan transition-all"
                                      placeholder="3"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-aquamarine mb-1">Rest Between Reps</label>
                                    <input 
                                      type="number" 
                                      inputMode="numeric"
                                      min="0"
                                      value={ex.restBetweenReps || ''}
                                      onChange={(e) => {
                                        const newExs = [...ssExercises];
                                        newExs[idx].restBetweenReps = e.target.value === '' ? '' : Number(e.target.value);
                                        setSsExercises(newExs);
                                      }}
                                      className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan transition-all"
                                      placeholder="2"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => setSsExercises([...ssExercises, { id: crypto.randomUUID(), name: '', reps: '', mode: 'manual' }])}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-cobalt/30 bg-transparent backdrop-blur-none hover:bg-transparent text-aquamarine transition-all group ${CONTAINER_BUTTON_CLASS}`}
                          >
                            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="font-bold tracking-wide">Add Exercise to Superset</span>
                          </button>
                        </div>
                    </form>
                  </>
                )}
                
                <div className="p-6 flex justify-center gap-8">
                  {builderSource === 'planner' ? (
                    <button 
                      type="button"
                      onClick={() => handleUnifiedSave('workout')}
                      className={`w-40 bg-transparent backdrop-blur-none text-aquamarine hover:text-white font-bold py-2 px-3 text-sm rounded-lg transition-all flex items-center justify-center border border-aquamarine ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save & Workout
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => handleUnifiedSave('library')}
                      className={`w-40 bg-transparent backdrop-blur-none text-aquamarine hover:text-white font-bold py-2 px-3 text-sm rounded-lg transition-all flex items-center justify-center border border-aquamarine ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save to Library
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => handleUnifiedSave('new')}
                    className={`w-40 bg-transparent backdrop-blur-none text-cyan hover:text-white font-bold py-2 px-3 text-sm rounded-lg transition-all flex items-center justify-center border border-cyan ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Save & New
                  </button>
                </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'ExerciseLibrary':
        return (
          <div className="relative min-h-screen overflow-hidden">
            <CosmicFlow phase={null} isPaused={false} status="active" />
            <div className="relative z-10 p-6 md:p-12 max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div 
                  onClick={() => setCurrentView('MainMenu')}
                  className="px-4 py-1.5 flex items-center gap-2 group border border-aquamarine bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(127,255,212,0.2)] hover:shadow-[0_0_20px_rgba(127,255,212,0.4)]"
                >
                  <X className="w-4 h-4 text-aquamarine group-hover:text-white transition-colors" />
                  <span className="text-xs font-bold text-aquamarine group-hover:text-white transition-colors uppercase tracking-widest">Exit</span>
                </div>

                <div className="relative">
                  <AccretionDisk size={56} color="#7FFFD4" />
                  <div 
                    onClick={() => {
                      setBuilderSource('library');
                      setCurrentView('ExerciseBuilder');
                    }}
                    className="relative z-40 w-12 h-12 rounded-full flex items-center justify-center p-0 group border border-aquamarine bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(127,255,212,0.2)] hover:shadow-[0_0_20px_rgba(127,255,212,0.4)]"
                    title="Add Exercise"
                  >
                    <Plus className="w-6 h-6 text-aquamarine group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>

              <div className="relative z-20 mb-4 text-center">
                <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan to-aquamarine text-transparent bg-clip-text uppercase italic tracking-tighter leading-tight">
                  Exercise Library
                </h2>
                <p className="text-aquamarine/60 text-sm tracking-[0.2em] uppercase mt-1">Your Movement Catalog</p>
              </div>

              <div className="relative z-30 p-6 border border-white rounded-2xl bg-black/40 backdrop-blur-md">
                <div className="space-y-6">
                {exerciseLibrary.length === 0 ? (
                  <div className="text-center py-12">
                    <Dumbbell className="w-12 h-12 mx-auto text-white/20 mb-4" />
                    <p className="text-aquamarine/60">Your library is empty. Add an exercise to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {exerciseLibrary.map((exercise) => (
                      <div key={exercise.id} className="p-4 bg-transparent">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-bold text-white">{exercise.name}</h4>
                        <span className="text-xs font-semibold bg-transparent text-aquamarine px-2 py-1 rounded">
                          {exercise.type}
                        </span>
                      </div>
                      {exercise.type === 'HIIT' ? (
                        <div className="grid grid-cols-5 gap-2 text-sm text-center">
                          <div className="bg-transparent rounded p-2 border border-white/5">
                            <div className="text-aquamarine/70 text-xs mb-1">Warm</div>
                            <div className="font-mono">{exercise.warmup}s</div>
                          </div>
                          <div className="bg-transparent rounded p-2 border border-white/5">
                            <div className="text-cyan/70 text-xs mb-1">Hard</div>
                            <div className="font-mono">{exercise.hard}s</div>
                          </div>
                          <div className="bg-transparent rounded p-2 border border-white/5">
                            <div className="text-teal/70 text-xs mb-1">Easy</div>
                            <div className="font-mono">{exercise.easy}s</div>
                          </div>
                          <div className="bg-transparent rounded p-2 border border-white/5">
                            <div className="text-cobalt/70 text-xs mb-1">Cool</div>
                            <div className="font-mono">{exercise.cooldown}s</div>
                          </div>
                          <div className="bg-transparent rounded p-2 border border-cyan/30">
                            <div className="text-cyan/70 text-xs mb-1">Rounds</div>
                            <div className="font-mono">{exercise.rounds}x</div>
                          </div>
                        </div>
                      ) : exercise.type === 'Set' ? (
                        <div className="grid grid-cols-4 gap-2 text-sm text-center">
                          <div className="bg-transparent rounded p-2 border border-white/5">
                            <div className="text-aquamarine/70 text-xs mb-1">Sets</div>
                            <div className="font-mono">{exercise.sets}</div>
                          </div>
                          <div className="bg-transparent rounded p-2 border border-white/5">
                            <div className="text-cyan/70 text-xs mb-1">Reps</div>
                            <div className="font-mono">{exercise.reps}</div>
                          </div>
                          <div className="bg-transparent rounded p-2 border border-white/5">
                            <div className="text-teal/70 text-xs mb-1 capitalize">Mode</div>
                            <div className="font-mono">{exercise.mode}</div>
                          </div>
                          <div className="bg-transparent rounded p-2 border border-cyan/30">
                            <div className="text-cyan/70 text-xs mb-1">Rest</div>
                            <div className="font-mono">{exercise.restBetweenSets || 0}s</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2 text-sm text-center">
                            <div className="bg-transparent rounded p-2 border border-white/5">
                              <div className="text-aquamarine/70 text-xs mb-1">Rounds</div>
                              <div className="font-mono">{exercise.totalSupersets}x</div>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-white/5">
                              <div className="text-cyan/70 text-xs mb-1">Exercises</div>
                              <div className="font-mono">{exercise.exercises.length}</div>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-white/5">
                              <div className="text-teal/70 text-xs mb-1 capitalize">Mode</div>
                              <div className="font-mono">{exercise.mode}</div>
                            </div>
                          </div>
                          <div className="text-xs text-aquamarine/60 pl-1">
                            {exercise.exercises.map(e => e.name).join(' • ')}
                          </div>
                        </div>
                      )}
                        <div className="mt-4 flex justify-end">
                          <button 
                            onClick={() => {
                              setExerciseLibrary(exerciseLibrary.filter(e => e.id !== exercise.id));
                            }}
                            className="p-2 text-stellar-ember hover:text-stellar-ember/80 bg-transparent backdrop-blur-none hover:bg-transparent rounded-lg transition-colors border border-stellar-ember/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                    </div>
                  ))}
                </div>
              )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'WorkoutPlanner':
        return (
          <div className="relative min-h-screen overflow-hidden">
            <CosmicFlow phase={null} isPaused={false} status="active" />
            <div className="relative z-10 p-6 md:p-12 max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div 
                  onClick={() => setCurrentView('MainMenu')}
                  className="px-4 py-1.5 flex items-center gap-2 group border border-aquamarine bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(127,255,212,0.2)] hover:shadow-[0_0_20px_rgba(127,255,212,0.4)]"
                >
                  <X className="w-4 h-4 text-aquamarine group-hover:text-white transition-colors" />
                  <span className="text-xs font-bold text-aquamarine group-hover:text-white transition-colors uppercase tracking-widest">Exit</span>
                </div>

                <div className="relative">
                  <AccretionDisk size={56} color="#7FFFD4" />
                  <div 
                    onClick={() => {
                      if (currentWorkout.length > 0) {
                        const nameToSave = workoutName || 'Untitled Workout';
                        const existingIndex = savedWorkouts.findIndex(w => w.name === nameToSave);
                        if (existingIndex >= 0) {
                          const updated = [...savedWorkouts];
                          updated[existingIndex] = { ...updated[existingIndex], items: currentWorkout };
                          setSavedWorkouts(updated);
                        } else {
                          const newWorkout = {
                            id: crypto.randomUUID(),
                            name: nameToSave,
                            items: currentWorkout
                          };
                          setSavedWorkouts([...savedWorkouts, newWorkout]);
                        }
                      }
                    }}
                    className="relative z-40 w-12 h-12 rounded-full flex items-center justify-center p-0 group border border-aquamarine bg-transparent backdrop-blur-none hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(127,255,212,0.2)] hover:shadow-[0_0_20px_rgba(127,255,212,0.4)] disabled:opacity-50"
                    title="Save Workout"
                  >
                    <Save className="w-5 h-5 text-aquamarine group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>

              <div className="relative z-40 mb-4 text-center">
                <h2 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-cyan to-aquamarine text-transparent bg-clip-text uppercase italic tracking-tighter leading-tight">
                  Workout Planner
                </h2>
              </div>

              <div className="space-y-6">
                {/* Container 1: Add an Exercise */}
                <div ref={containerRef} className="relative z-30 overflow-hidden border border-white rounded-2xl">
                  {/* Background Layer with Mask */}
                  <div 
                    className="absolute inset-0 bg-black/40 backdrop-blur-md z-0"
                    style={{ maskImage: buttonHoleMask, WebkitMaskImage: buttonHoleMask }}
                  />
                  {/* Overlay Layer for White Borders */}
                  <div 
                    className="absolute inset-0 z-50 pointer-events-none"
                    style={{ backgroundImage: buttonHoleOverlay }}
                  />
                  
                  {/* Content Layer */}
                  <div className="relative z-40">
                    {/* Exercise Type Selection Section */}
                    <div className="p-6 flex flex-col items-center gap-4">
                      {/* Save and Start Button */}
                      <button 
                        onClick={handleSaveAndStart} 
                        className={`text-formula-green border border-formula-green px-4 py-2 text-sm rounded-lg transition-colors flex items-center justify-center w-fit ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                      >
                        <Play className="w-4 h-4 mr-2" /> Save and Start
                      </button>

                      <div className="flex w-full justify-center gap-4">
                        <button 
                          onClick={() => {
                            setBuilderSource('planner');
                            setCurrentView('ExerciseBuilder');
                          }}
                          className={`text-aquamarine border border-aquamarine px-4 py-2 text-sm rounded-md transition-colors flex items-center justify-center w-fit ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                        >
                          <Plus className="w-4 h-4 mr-2" /> + Build an Exercise
                        </button>
                      </div>
                      <button onClick={() => setShowLibrary(true)} className={`text-aquamarine border border-aquamarine px-2 py-0.5 text-xs rounded-md transition-colors flex items-center justify-center w-fit ${CONTAINER_BUTTON_CLASS} container-button-hole`}>
                        <ListPlus className="w-3 h-3 mr-1" /> Add from Library
                      </button>
                    </div>
                  </div>
                </div>

                {/* Container 2: Workout List Section */}
                <div className="relative z-30 p-6 border border-white rounded-2xl bg-black/40 backdrop-blur-md">
                  <input 
                    type="text" 
                    value={workoutName}
                    onChange={(e) => setWorkoutName(e.target.value)}
                    className="bg-transparent border-b-2 border-cobalt/50 text-xl font-bold text-white px-1 py-1 focus:outline-none focus:border-cyan transition-colors placeholder:text-white/20 w-full mb-6 text-center"
                    placeholder="Exercise"
                  />

                  <div className="space-y-4">
                    {currentWorkout.length === 0 ? (
                      <div className="text-center py-8">
                        <ClipboardList className="w-12 h-12 mx-auto text-white/20 mb-4" />
                        <p className="text-aquamarine/60">Your workout is empty. Add exercises to begin.</p>
                      </div>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={currentWorkout.map(i => i.uniqueId)} strategy={verticalListSortingStrategy}>
                          {currentWorkout.map((item, index) => (
                            <SortableExerciseItem 
                              key={item.uniqueId} 
                              item={item} 
                              index={index} 
                              editExercise={editExercise} 
                              toggleExpand={toggleExpand} 
                              removeItem={removeItem} 
                              expandedItems={expandedItems} 
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </div>
              </div>

            {/* Library Modal Overlay */}
            {showLibrary && (
              <div className="fixed inset-0 bg-transparent backdrop-blur-[1.5px] flex items-center justify-center z-50 p-4">
                <div className="w-full max-w-2xl max-h-[80vh] flex flex-col p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-cyan">Select Exercise</h3>
                    <button onClick={() => setShowLibrary(false)} className={`text-white/60 hover:text-white p-1 rounded-lg border-white/10 ${TOOLBAR_BUTTON_CLASS}`}>
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 space-y-3">
                    {exerciseLibrary.length === 0 ? (
                      <div className="text-center py-8 text-aquamarine/60">
                        No exercises in library. Go to Exercise Builder to create some.
                      </div>
                    ) : (
                      exerciseLibrary.map(ex => (
                        <div key={ex.id} className="bg-transparent border border-white/10 rounded-xl p-4 flex justify-between items-center hover:border-cyan/50 transition-colors">
                          <div>
                            <h4 className="font-bold text-white">{ex.name}</h4>
                            <div className="text-xs text-aquamarine/60 mt-1">
                              {ex.type === 'HIIT' ? `${ex.rounds} rounds` : ex.type === 'Set' ? `${ex.sets} sets x ${ex.reps} reps` : `${ex.totalSupersets} rounds x ${ex.exercises.length} exercises`} • {ex.type}
                            </div>
                          </div>
                          <button 
                            onClick={() => addFromLibrary(ex)}
                            className={`bg-transparent backdrop-blur-none hover:bg-transparent text-cyan border border-cyan/30 px-4 py-2 rounded-lg transition-colors flex items-center ${CONTAINER_BUTTON_CLASS}`}
                          >
                            <Plus className="w-4 h-4 mr-2" /> Add
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Custom Builder Modal Overlay */}
            {customBuilderType && (
              <div className="fixed inset-0 bg-transparent backdrop-blur-[1.5px] flex items-center justify-center z-50 p-4">
                <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-cyan">Design {customBuilderType} Exercise</h3>
                    <button onClick={() => setCustomBuilderType(null)} className={`text-white/60 hover:text-white p-1 rounded-lg border-white/10 ${TOOLBAR_BUTTON_CLASS}`}>
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <form onSubmit={handleSaveCustomExercise} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-aquamarine/60 mb-1">Exercise Name</label>
                      <input 
                        type="text" 
                        value={cbName}
                        onChange={(e) => setCbName(e.target.value)}
                        onFocus={() => setCbName('')}
                        className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                        placeholder="-enter name-"
                        required
                      />
                    </div>
                    
                    {customBuilderType === 'HIIT' ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-aquamarine/60 mb-1">Warmup</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="0"
                              value={cbWarmup}
                              onChange={(e) => setCbWarmup(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setCbWarmup('')}
                              className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-aquamarine/60 mb-1">Cooldown</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="0"
                              value={cbCooldown}
                              onChange={(e) => setCbCooldown(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setCbCooldown('')}
                              className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-aquamarine/60 mb-1">Phase 1</label>
                            <input 
                              type="text"
                              value={cbHardName}
                              onChange={(e) => setCbHardName(e.target.value)}
                              onFocus={() => setCbHardName('')}
                              className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="-enter name-"
                            />
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="1"
                              value={cbHard}
                              onChange={(e) => setCbHard(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setCbHard('')}
                              className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-aquamarine/60 mb-1">Phase 2</label>
                            <input 
                              type="text"
                              value={cbEasyName}
                              onChange={(e) => setCbEasyName(e.target.value)}
                              onFocus={() => setCbEasyName('')}
                              className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="-enter name-"
                            />
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="1"
                              value={cbEasy}
                              onChange={(e) => setCbEasy(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setCbEasy('')}
                              className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="0:60"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-aquamarine/60 mb-1">Number of Rounds</label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            min="1"
                            value={cbRounds}
                            onChange={(e) => setCbRounds(e.target.value === '' ? '' : Number(e.target.value))}
                            onFocus={() => setCbRounds('')}
                            className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                            placeholder="5"
                            required
                          />
                        </div>

                        <div className="space-y-3 pt-4 border-t border-white/10">
                          <h4 className="text-sm font-medium text-aquamarine uppercase tracking-wider">Metronome Settings</h4>
                          {[
                            { label: 'Warmup', enabled: cbWarmupMetronome, setEnabled: setCbWarmupMetronome, bpm: cbWarmupBpm, setBpm: setCbWarmupBpm },
                            { label: 'Hard', enabled: cbHardMetronome, setEnabled: setCbHardMetronome, bpm: cbHardBpm, setBpm: setCbHardBpm },
                            { label: 'Easy', enabled: cbEasyMetronome, setEnabled: setCbEasyMetronome, bpm: cbEasyBpm, setBpm: setCbEasyBpm },
                            { label: 'Cooldown', enabled: cbCooldownMetronome, setEnabled: setCbCooldownMetronome, bpm: cbCooldownBpm, setBpm: setCbCooldownBpm },
                          ].map((p) => (
                            <div key={p.label} className="flex items-center justify-between p-3 bg-transparent rounded-xl border border-white/10">
                              <button
                                type="button"
                                onClick={() => p.setEnabled(!p.enabled)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${p.enabled ? 'bg-cobalt text-white shadow-[0_0_10px_rgba(0,71,171,0.5)]' : 'bg-transparent text-white/40'}`}
                              >
                                {p.label}
                              </button>
                              {p.enabled && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-aquamarine/60 uppercase">BPM</span>
                                  <input
                                    type="number" inputMode="numeric" pattern="[0-9]*"
                                    value={p.bpm}
                                    onChange={(e) => p.setBpm(e.target.value === '' ? '' : Number(e.target.value))}
                                    onFocus={() => p.setBpm('')}
                                    className="w-16 bg-transparent border border-white/20 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : customBuilderType === 'Set' ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-aquamarine/60 mb-1">Total Sets</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="1"
                              value={cbSets}
                              onChange={(e) => setCbSets(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setCbSets('')}
                              className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="3"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-aquamarine/60 mb-1">Reps per Set</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="1"
                              value={cbReps}
                              onChange={(e) => setCbReps(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setCbReps('')}
                              className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="10"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-aquamarine/60 mb-2">Mode Selection</label>
                          <div className="flex gap-2">
                            {(['manual', 'time'] as const).map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setCbMode(m)}
                                className={`flex-1 py-2 rounded-lg border transition-colors capitalize backdrop-blur-none ${cbMode === m ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60 hover:bg-transparent'}`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>

                        {cbMode === 'time' && (
                          <div className="space-y-4 p-4 bg-transparent rounded-lg border border-white/5">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setCbUseRepDuration(!cbUseRepDuration)}
                                className={`flex-1 py-2 text-xs rounded-lg border transition-colors backdrop-blur-none ${cbUseRepDuration ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60'}`}
                              >
                                Rep Duration
                              </button>
                              <button
                                type="button"
                                onClick={() => setCbUseRestBetweenReps(!cbUseRestBetweenReps)}
                                className={`flex-1 py-2 text-xs rounded-lg border transition-colors backdrop-blur-none ${cbUseRestBetweenReps ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60'}`}
                              >
                                Rest Between Reps
                              </button>
                              <button
                                type="button"
                                onClick={() => setCbUseRestBetweenSets(!cbUseRestBetweenSets)}
                                className={`flex-1 py-2 text-xs rounded-lg border transition-colors backdrop-blur-none ${cbUseRestBetweenSets ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60'}`}
                              >
                                Rest Between Sets
                              </button>
                            </div>

                            <div className="space-y-3">
                              {cbUseRepDuration && (
                                <div>
                                  <label className="block text-xs font-medium text-aquamarine/60 mb-1">Rep Duration</label>
                                  <input 
                                    type="number" 
                                    inputMode="numeric"
                                    min="1"
                                    value={cbRepDuration}
                                    onChange={(e) => setCbRepDuration(e.target.value === '' ? '' : Number(e.target.value))}
                                    onFocus={() => setCbRepDuration('')}
                                    className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                                    placeholder="0:60"
                                    required
                                  />
                                </div>
                              )}
                              {cbUseRestBetweenReps && (
                                <div>
                                  <label className="block text-xs font-medium text-aquamarine/60 mb-1">Rest Between Reps</label>
                                  <input 
                                    type="number" 
                                    inputMode="numeric"
                                    min="1"
                                    value={cbRestBetweenReps}
                                    onChange={(e) => setCbRestBetweenReps(e.target.value === '' ? '' : Number(e.target.value))}
                                    onFocus={() => setCbRestBetweenReps('')}
                                    className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                                    placeholder="0:60"
                                    required
                                  />
                                </div>
                              )}
                              {cbUseRestBetweenSets && (
                                <div>
                                  <label className="block text-xs font-medium text-aquamarine/60 mb-1">Rest Between Sets</label>
                                  <input 
                                    type="number" 
                                    inputMode="numeric"
                                    min="1"
                                    value={cbRestBetweenSets}
                                    onChange={(e) => setCbRestBetweenSets(e.target.value === '' ? '' : Number(e.target.value))}
                                    onFocus={() => setCbRestBetweenSets('')}
                                    className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                                    placeholder="0:60"
                                    required
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-aquamarine/60 mb-1">Total Supersets</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="1"
                              value={cbSsTotalSupersets}
                              onChange={(e) => setCbSsTotalSupersets(e.target.value === '' ? '' : Number(e.target.value))}
                              onFocus={() => setCbSsTotalSupersets('')}
                              className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                              placeholder="3"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-aquamarine/60 mb-2">Mode</label>
                            <div className="flex gap-2">
                              {(['manual', 'timed'] as const).map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setCbSsMode(m)}
                                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize backdrop-blur-none ${cbSsMode === m ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60 hover:bg-transparent'}`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {cbSsMode === 'timed' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-aquamarine/60 mb-1">Exercise Transition</label>
                              <input 
                                type="number" 
                                inputMode="numeric"
                                min="0"
                                value={cbSsExerciseTransition}
                                onChange={(e) => setCbSsExerciseTransition(e.target.value === '' ? '' : Number(e.target.value))}
                                onFocus={() => setCbSsExerciseTransition('')}
                                className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                                placeholder="Duration (sec)"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-aquamarine/60 mb-1">Superset Rest</label>
                              <input 
                                type="number" 
                                inputMode="numeric"
                                min="0"
                                value={cbSsSupersetTransition}
                                onChange={(e) => setCbSsSupersetTransition(e.target.value === '' ? '' : Number(e.target.value))}
                                onFocus={() => setCbSsSupersetTransition('')}
                                className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-all"
                                placeholder="Duration (sec)"
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <h4 className="text-lg font-medium text-aquamarine">Exercises</h4>

                          {cbSsExercises.map((ex, idx) => (
                            <div key={ex.id} className="p-4 bg-transparent border border-white/10 rounded-xl space-y-4 relative group">
                              <button
                                type="button"
                                onClick={() => setCbSsExercises(cbSsExercises.filter(e => e.id !== ex.id))}
                                className="absolute top-4 right-4 text-white/20 hover:text-stellar-ember transition-colors"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-aquamarine/60 mb-1">Exercise Name</label>
                                    <input 
                                      type="text" 
                                      value={ex.name}
                                      onChange={(e) => {
                                        const newExs = [...cbSsExercises];
                                        newExs[idx].name = e.target.value;
                                        setCbSsExercises(newExs);
                                      }}
                                      onFocus={() => {
                                        const newExs = [...cbSsExercises];
                                        newExs[idx].name = '';
                                        setCbSsExercises(newExs);
                                      }}
                                      className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan transition-all"
                                      placeholder="-enter name-"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-aquamarine/60 mb-1">Reps</label>
                                    <input 
                                      type="number" 
                                      inputMode="numeric"
                                      min="1"
                                      value={ex.reps}
                                      onChange={(e) => {
                                        const newExs = [...cbSsExercises];
                                        newExs[idx].reps = e.target.value === '' ? '' : Number(e.target.value);
                                        setCbSsExercises(newExs);
                                      }}
                                      onFocus={() => {
                                        const newExs = [...cbSsExercises];
                                        newExs[idx].reps = '';
                                        setCbSsExercises(newExs);
                                      }}
                                      className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan transition-all"
                                      placeholder="12"
                                      required
                                    />
                                  </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-aquamarine/60 mb-2">Mode</label>
                                <div className="flex gap-2">
                                  {(['manual', 'time'] as const).map(m => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => {
                                        const newExs = [...cbSsExercises];
                                        newExs[idx].mode = m;
                                        setCbSsExercises(newExs);
                                      }}
                                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize backdrop-blur-none ${ex.mode === m ? 'bg-transparent border-cyan text-aquamarine shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'bg-transparent border-white/10 text-white/60 hover:bg-transparent'}`}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {ex.mode === 'time' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-medium text-aquamarine/60 mb-1">Rep Duration</label>
                                      <input 
                                        type="number" 
                                        inputMode="numeric"
                                        min="1"
                                        value={ex.repDuration || ''}
                                        onChange={(e) => {
                                          const newExs = [...cbSsExercises];
                                          newExs[idx].repDuration = e.target.value === '' ? '' : Number(e.target.value);
                                          setCbSsExercises(newExs);
                                        }}
                                        onFocus={() => {
                                          const newExs = [...cbSsExercises];
                                          newExs[idx].repDuration = '';
                                          setCbSsExercises(newExs);
                                        }}
                                        className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-cyan transition-all"
                                        placeholder="0:60"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-aquamarine/60 mb-1">Rest Between Reps</label>
                                      <input 
                                        type="number" 
                                        inputMode="numeric"
                                        min="0"
                                        value={ex.restBetweenReps || ''}
                                        onChange={(e) => {
                                          const newExs = [...cbSsExercises];
                                          newExs[idx].restBetweenReps = e.target.value === '' ? '' : Number(e.target.value);
                                          setCbSsExercises(newExs);
                                        }}
                                        onFocus={() => {
                                          const newExs = [...cbSsExercises];
                                          newExs[idx].restBetweenReps = '';
                                          setCbSsExercises(newExs);
                                        }}
                                        className="w-full bg-transparent backdrop-blur-md border border-white/20 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-cyan transition-all"
                                        placeholder="0:60"
                                      />
                                    </div>
                                </div>
                              )}
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => setCbSsExercises([...cbSsExercises, { id: crypto.randomUUID(), name: '', reps: '', mode: 'manual' }])}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-cobalt/30 bg-transparent backdrop-blur-none hover:bg-transparent text-aquamarine transition-all group ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                          >
                            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="font-bold tracking-wide">Add Exercise to Superset</span>
                          </button>
                        </div>
                      </>
                    )}

                    <button 
                      type="submit"
                      className={`w-full mt-6 bg-transparent backdrop-blur-none text-aquamarine hover:text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center ${CONTAINER_BUTTON_CLASS} container-button-hole`}
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Add to Workout
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
        );

      case 'WorkoutMode':
        return <WorkoutEngine workout={currentWorkout} name={workoutName} onExit={() => setCurrentView('WorkoutPlanner')} />;
    }
  };

  return (
    <div className="min-h-screen bg-absolute-void text-white selection:bg-cobalt/30">
      {renderView()}
      {/* Save and Start Modal */}
      {saveAndStartModal !== 'none' && (
        <div className="fixed inset-0 bg-transparent backdrop-blur-[1.5px] flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm text-center">
            <h3 className="text-2xl font-bold text-white mb-4">
              {saveAndStartModal === 'both' && "Workout unnamed and no exercises"}
              {saveAndStartModal === 'unnamed' && "Your workout is not named"}
              {saveAndStartModal === 'noExercises' && "Your workout has no exercises"}
            </h3>
            {saveAndStartModal === 'unnamed' && (
              <p className="text-aquamarine/60 mb-8">Would you like to use a generic name?</p>
            )}
            <div className="flex gap-4 justify-center">
              {saveAndStartModal === 'unnamed' ? (
                <>
                  <button 
                    onClick={() => setSaveAndStartModal('none')} 
                    className="px-6 py-2 rounded-lg bg-transparent hover:bg-white/20 text-white transition-colors"
                  >
                    Name workout
                  </button>
                  <button 
                    onClick={() => {
                      const name = getNextWorkoutName();
                      saveAndStartWorkout(name);
                      setSaveAndStartModal('none');
                    }} 
                    className="px-6 py-2 rounded-lg bg-transparent hover:bg-cyan/40 text-cyan border border-cyan/50 transition-colors"
                  >
                    Use generic name
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setSaveAndStartModal('none')} 
                  className="px-6 py-2 rounded-lg bg-transparent hover:bg-white/20 text-white transition-colors"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
