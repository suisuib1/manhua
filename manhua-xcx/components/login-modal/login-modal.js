Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    handleClose() {
      this.triggerEvent('close')
    },

    handleConfirm() {
      this.triggerEvent('confirm')
    },

    stopPropagation() {
      return null
    },
  },
})
