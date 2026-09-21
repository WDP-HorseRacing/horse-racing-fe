// Tiếng bíp ngắn kèm cảnh báo đỏ. Dùng Web Audio để không phải tải tệp âm thanh.
let context: AudioContext | null = null;

export function playAlertBeep() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context = context ?? new Ctor();
    if (context.state === 'suspended') void context.resume();

    const play = (startAt: number, frequency: number) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.2);
    };

    const start = context.currentTime;
    play(start, 880);
    play(start + 0.24, 1046);
  } catch {
    // Trình duyệt chặn âm thanh khi người dùng chưa tương tác — bỏ qua.
  }
}
