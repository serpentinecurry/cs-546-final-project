import {dbConnection} from './mongoConnection.js';

const getCollectionFn = (collection) => {
  let _col = undefined;

  return async () => {
    if (!_col) {
      const db = await dbConnection();
      _col = await db.collection(collection);
    }

    return _col;
  };
};

export const users = getCollectionFn('users');
export const courses = getCollectionFn('courses');
export const lectures = getCollectionFn('lectures');
export const attendance = getCollectionFn('attendance');
export const discussions = getCollectionFn('discussions');