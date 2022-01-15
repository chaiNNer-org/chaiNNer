export default (category) => {
  switch (category) {
    case 'OpenCV':
      return '#C53030';
    case 'NumPy':
      return '#2B6CB0';
    case 'PyTorch':
      return '#DD6B20';
    default:
      return '#718096';
  }
};
