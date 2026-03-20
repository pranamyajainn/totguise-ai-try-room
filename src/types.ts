export interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  url: string;
  category: 'tops' | 'bottoms' | 'dresses' | 'sets';
}

export type AppState = 'upload' | 'select' | 'generating' | 'result';
