import React, {useEffect} from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Home = () :ReactElement => {
  const navigate = useNavigate();
  const checkSession = async () => {
    return await axios.get('/api/user/me');
  }

  const q = useQuery({queryKey: ['sessionLookup'], queryFn: checkSession})
  const user : {username: string, decks: {name: string, id: string}[]} = q.data?.data.user

  const handleClickDeck = (e : React.MouseEvent, id : string) => {
    navigate(`/deck/${id}`);
  }

  useEffect(() => {
    if (q.isError) { navigate('/login'); }
  }, [q.isError])

  return (
    <>
      Welcome Home
      <hr/>
      {user && user.decks ? user.decks.map(({name, id}, index) => <a onClick={(e) => handleClickDeck(e, id)} key={name+ index}>{name}</a>) : <>No decks</>}
    </>
  )
}

export default Home;