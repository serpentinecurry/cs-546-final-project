export const isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { error: 'Unauthorized: Admins only' });
  }
  next();
};

// Just prevents logged-in users from accessing login/register again
export const preventDoubleLogin = (req, res, next) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}`);
  }
  next();
};
