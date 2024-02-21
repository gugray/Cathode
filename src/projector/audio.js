import Meyda from 'meyda'

// Adatped from Hydra by Olivia Jack
// https://github.com/hydra-synth/hydra-synth/blob/main/src/lib/audio.js
// Used under the AGPL license
// 2024-02-21: modified by Gabor L Ugray

export default class Audio {
  constructor({
                numBins = 4,
                cutoff = 2,
                smooth = 0.4,
                max = 15,
                scale = 10,
              }) {
    this.vol = 0
    this.scale = scale
    this.max = max
    this.cutoff = cutoff
    this.smooth = smooth
    this.setBins(numBins)
    this.isBeat = false;

    // beat detection from: https://github.com/therewasaguy/p5-music-viz/blob/gh-pages/demos/01d_beat_detect_amplitude/sketch.js
    this.beat = {
      holdFrames: 20,
      threshold: 40,
      _cutoff: 0, // adaptive based on sound state
      decay: 0.98,
      _framesSinceBeat: 0 // keeps track of frames
    }

    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia({video: false, audio: true})
        .then((stream) => {
          this.stream = stream
          this.context = new AudioContext()
          let audio_stream = this.context.createMediaStreamSource(stream)
          this.meyda = Meyda.createMeydaAnalyzer({
            audioContext: this.context,
            source: audio_stream,
            featureExtractors: ['loudness'],
          })
        })
        .catch((err) => console.log('ERROR', err))
    }
  }

  detectBeat(level) {
    if (level > this.beat._cutoff && level > this.beat.threshold) {
      this.isBeat = true
      this.beat._cutoff = level * 1.2
      this.beat._framesSinceBeat = 0
    } else {
      this.isBeat = false
      if (this.beat._framesSinceBeat <= this.beat.holdFrames) {
        this.beat._framesSinceBeat++;
      } else {
        this.beat._cutoff *= this.beat.decay
        this.beat._cutoff = Math.max(this.beat._cutoff, this.beat.threshold);
      }
    }
  }

  tick() {
    if (this.meyda) {
      var features = this.meyda.get()
      if (features && features !== null) {
        this.vol = features.loudness.total
        this.detectBeat(this.vol)
        // reduce loudness array to number of bins
        const reducer = (accumulator, currentValue) => accumulator + currentValue;
        let spacing = Math.floor(features.loudness.specific.length / this.bins.length)
        this.prevBins = this.bins.slice(0)
        this.bins = this.bins.map((bin, index) => {
          return features.loudness.specific.slice(index * spacing, (index + 1) * spacing).reduce(reducer)
        }).map((bin, index) => {
          // map to specified range
          return (bin * (1.0 - this.settings[index].smooth) + this.prevBins[index] * this.settings[index].smooth)
        })
        this.fft = this.bins.map((bin, index) => (
          Math.max(0, (bin - this.settings[index].cutoff) / this.settings[index].scale)
        ))
      }
    }
  }

  setCutoff(cutoff) {
    this.cutoff = cutoff
    this.settings = this.settings.map((el) => {
      el.cutoff = cutoff
      return el
    })
  }

  setSmooth(smooth) {
    this.smooth = smooth
    this.settings = this.settings.map((el) => {
      el.smooth = smooth
      return el
    })
  }

  setBins(numBins) {
    this.bins = Array(numBins).fill(0)
    this.prevBins = Array(numBins).fill(0)
    this.fft = Array(numBins).fill(0)
    this.settings = Array(numBins).fill(0).map(() => ({
      cutoff: this.cutoff,
      scale: this.scale,
      smooth: this.smooth
    }))
    // to do: what to do in non-global mode?
    this.bins.forEach((bin, index) => {
      window['a' + index] = (scale = 1, offset = 0) => () => (a.fft[index] * scale + offset)
    })
    //  console.log(this.settings)
  }

  setScale(scale) {
    this.scale = scale
    this.settings = this.settings.map((el) => {
      el.scale = scale
      return el
    })
  }
}
