export const alreadyLoggedIn = (req, res, next) => {
   const allowedPaths = ["/", "/login"];
  if (!allowedPaths.includes(req.path)) return next();
  if (req.session.user) {
    if (req.session.user.role === "professor")
      return res.redirect("/professor");
    else if (req.session.user.role === "student")
      return res.redirect("/student");
    else if (req.session.user.role === "ta") return res.redirect("/ta");
    else if (req.session.user.role === "admin") return res.redirect("/admin");
  }
  next();
};

export const alreadyRegistered = (req, res, next) => {
  if (req.session.user) {
    if (req.session.user.role === "professor")
      return res.redirect("/professor");
    else if (req.session.user.role === "student")
      return res.redirect("/student");
    else if (req.session.user.role === "ta") return res.redirect("/ta");
    else if (req.session.user.role === "admin") return res.redirect("/admin");
  }
  next();
};

export const isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('home', { error: 'Unauthorized: Admins only' });
  }
  next();
};