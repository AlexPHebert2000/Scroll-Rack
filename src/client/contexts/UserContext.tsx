import React, {useState, useContext, createContext} from "react";

const UserContext = createContext(null);
const UpdateUserContext = createContext(null);

export const useUser = () => {
  return useContext(UserContext);
}

export const useUpdateUser = () => {
  return useContext(UpdateUserContext);
}

export const UserProvider = ({value, children}) => {
  const [user, setUser] = useState(null);
  return (
    <UserContext.Provider value={user}>
      <UpdateUserContext.Provider value={setUser}>
        {children}
      </UpdateUserContext.Provider>
    </UserContext.Provider>
  )
}

export default UserProvider