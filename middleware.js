export const isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { error: 'Unauthorized: Admins only' });
  }
  next();
};

export const isStudent = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'student' && req.session.user.role !== 'ta') {
    return res.status(403).render('error', { error: 'Unauthorized: Students only' });
  }
  next();
};

export const preventDoubleLogin = (req, res, next) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}`);
  }
  next();
};


