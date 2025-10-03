let onlineCount = 0;

module.exports = function attachSocket(io) {
  io.on('connection', (socket) => {
    onlineCount++;
    io.emit('onlineUsers', onlineCount);

    // (ถ้าต้องแยกสมาชิกล็อกอิน/ทั่วไป สามารถเพิ่ม logic ตรวจ token ได้ที่นี่)

    socket.on('disconnect', () => {
      onlineCount = Math.max(0, onlineCount - 1);
      io.emit('onlineUsers', onlineCount);
    });
  });
};
