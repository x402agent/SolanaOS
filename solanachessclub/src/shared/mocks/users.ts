import { DEFAULT_IMAGES } from "@/shared/config/constants";

export interface UserItem {
  id: string;
  name: string;
  username: string;
  image: any;
  following: boolean;
}

export const dummyData: UserItem[] = [
  {
    id: '1',
    name: 'Jian',
    username: '@jianYang',
    image: DEFAULT_IMAGES.SENDlogo,
    following: false,
  },
  {
    id: '2',
    name: 'John',
    username: '@johnDoe',
    image: DEFAULT_IMAGES.SENDlogo,
    following: true,
  },
  {
    id: '3',
    name: 'Alice',
    username: '@aliceSmith',
    image: DEFAULT_IMAGES.SENDlogo,
    following: false,
  },
  {
    id: '4',
    name: 'Bob',
    username: '@bob123',
    image: DEFAULT_IMAGES.SENDlogo,
    following: true,
  },
  {
    id: '5',
    name: 'Charlie',
    username: '@charlieBrown',
    image: DEFAULT_IMAGES.SENDlogo,
    following: false,
  },
  {
    id: '6',
    name: 'David',
    username: '@davidKing',
    image: DEFAULT_IMAGES.SENDlogo,
    following: true,
  },
  {
    id: '7',
    name: 'Eve',
    username: '@eveMiller',
    image: DEFAULT_IMAGES.SENDlogo,
    following: false,
  },
  {
    id: '8',
    name: 'Frank',
    username: '@frankWhite',
    image: DEFAULT_IMAGES.SENDlogo,
    following: true,
  },
  {
    id: '9',
    name: 'Grace',
    username: '@graceLee',
    image: DEFAULT_IMAGES.SENDlogo,
    following: false,
  },
  {
    id: '10',
    name: 'Hank',
    username: '@hankWright',
    image: DEFAULT_IMAGES.SENDlogo,
    following: false,
  },
];
