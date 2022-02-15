export default (category, subcategory) => {
  if (subcategory) {
    switch (`${category}|${subcategory}`) {
      case 'Image|I/O':
        return '#C53030';
      case 'Image|Effect':
        return '#F56565';
      case 'Image|Utility':
        return '#9B2C2C';
      case 'Image':
        return '#C53030';
      case 'NumPy':
        return '#2B6CB0';
      case 'PyTorch':
        return '#DD6B20';
      default:
        return '#718096';
    }
  }
  switch (category) {
    case 'OpenCV':
      return '#C53030';
    case 'Image':
      return '#C53030';
    case 'NumPy':
      return '#2B6CB0';
    case 'PyTorch':
      return '#DD6B20';
    default:
      return '#718096';
  }
};
