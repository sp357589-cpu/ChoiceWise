# Push this project to GitHub

This workspace is ready for deployment.

## Steps to push to GitHub

1. Open a terminal in `C:\Decision_Maker`.
2. Initialize git if needed:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit: ChoiceWise ready for Render"
   ```
3. Add the GitHub remote (replace with your repo URL):
   ```powershell
   git remote add origin https://github.com/sp357589-cpu/ChoiceWise.git
   ```
4. Push to GitHub:
   ```powershell
   git branch -M main
   git push -u origin main
   ```

## Notes
- The repo already contains deployment files: `Procfile`, `runtime.txt`, `requirements.txt`.
- The Flask backend is in `backend/app.py`, serving the frontend from the repo root.
- If you have not created the GitHub repo yet, do so first on GitHub, then add the remote.
